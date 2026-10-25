# 🚀 Mini-Projet 2 : Déploiement d'une application 3-tiers sur Kubernetes (k3s)

Bienvenue dans ce projet de déploiement d'une application 3-tiers (Frontend Nginx, API Node.js, Base de données PostgreSQL) sur un cluster Kubernetes haute disponibilité (1 Master, 2 Agents).

L'ensemble de l'administration a été réalisée **à distance depuis un terminal Windows (PowerShell)** via `kubectl`, sans jamais avoir besoin de se connecter en SSH aux machines virtuelles.

---

## 🏗️ Architecture de l'application

L'application suit une architecture stricte à 3 niveaux :
1. **Frontend** : Serveur Nginx (non-root, port 8080) affichant l'interface utilisateur et faisant office de reverse-proxy pour l'API.
2. **API** : Application Node.js (port 3000) gérant la logique métier et exposant des routes REST (`/api/tasks`) ainsi que des sondes de santé (`/health`, `/ready`).
3. **Base de données** : PostgreSQL 16, déployée avec un volume persistant pour garantir la sauvegarde des données.

**Flux réseau** : `Internet -> Ingress (Traefik) -> Frontend -> API -> Base de données`

---

## 📸 Preuves d'implémentation et Explications (E1 à E15)

### 1. Gestion des ressources et Isolation (E1, E2, E8)
*   **E1 (Images)** : Les images (`tasks-api:1.0.0`, `tasks-frontend:1.0.0`) sont versionnées. J'ai importé les images directement dans le cluster via `k3s ctr images import` pour éviter de dépendre d'un registre externe.
    ![E1](preuves/01-E1-image-versionnee.png)
*   **E2 (Namespace & Quota)** : Création du namespace `taches` isolé. Un `ResourceQuota` limite les ressources (ex: max 20 pods, 2 CPUs). J'ai également appliqué le profil de sécurité **Pod Security Admission (PSA)** en mode `baseline` pour interdire les conteneurs privilégiés.
    ![E2 Namespace](preuves/02-E2-namespace.png)
    ![E2 Quota](preuves/03-E2-quota.png)
*   **E8 (LimitRange)** : Application d'un `LimitRange` pour imposer des requêtes et limites par défaut (ex: 100m CPU / 128Mi RAM) à tous les conteneurs qui n'en déclarent pas.
    ![E8](preuves/04-E8-limitrange.png)

### 2. Séparation de la configuration (E3, E4)
*   **E3 (ConfigMap)** : Les variables non-sensibles (`DB_HOST`, `DB_PORT`, `DB_NAME`) sont externalisées dans un ConfigMap `app-config`.
    ![E3](preuves/05-E3-configmap.png)
*   **E4 (Secret)** : Les identifiants de la base de données sont stockés dans un Secret `db-credentials`. *Bonne pratique* : il a été créé de manière impérative (`kubectl create secret`) pour ne jamais écrire de mot de passe en clair dans un fichier versionné. Le fichier `.gitignore` prouve cette rigueur.
    ![E4 Secret](preuves/06-E4-secret.png)
    ![E4 Gitignore](preuves/07-E4-gitignore.png)

### 3. Persistance des données (E5, E6)
*   **E5 (StatefulSet)** : PostgreSQL est déployé via un `StatefulSet` (et non un Deployment) pour garantir une identité réseau stable (`db-0`). Un `volumeClaimTemplates` provisionne dynamiquement un volume (PVC) de 1Gi.
    ![E5](preuves/08-E5-db-statefulset.png)
*   **E6 (Persistance)** : La preuve ultime : j'ai supprimé le pod `db-0`. Kubernetes l'a recréé automatiquement, et les données saisies dans l'interface web étaient toujours présentes (grâce au PVC).
    ![E6](preuves/13-E6-persistance.png)

### 4. Déploiement applicatif et Haute Disponibilité (E7, E9)
*   **E7 (InitContainer & Probes)** : L'API utilise un `initContainer` (`wait-for-db`) pour attendre que la base de données soit prête avant de démarrer. Elle utilise des sondes `readinessProbe` (sur `/ready`) et `livenessProbe` (sur `/health`) pour que Kubernetes sache si le pod est apte à recevoir du trafic.
    ![E7](preuves/09-E7-api-probes.png)
*   **E9 (Déploiement)** : L'API et le Frontend sont en haute disponibilité (2 réplicas chacun).
    ![E9](preuves/10-E9-tout-est-deploye.png)

### 5. Exposition et Sauvegarde (E10, E11)
*   **E10 (Ingress)** : Exposition de l'application à l'extérieur via un Ingress Traefik sur le nom de domaine `app.k3s.local`.
    ![E10 Ingress](preuves/11-E10-ingress.png)
    ![E10 Navigateur](preuves/12-E10-navigateur.png)
*   **E11 (CronJob de sauvegarde)** : Un `CronJob` s'exécute toutes les 5 minutes pour faire un `pg_dump` de la base de données vers un volume dédié (`backup-pvc`). Un job de test a été exécuté avec succès.
    ![E11](preuves/14-E11-backup.png)

### 6. Sécurité : RBAC, Durcissement et Réseau (E12, E13, E14)
*   **E12 (RBAC)** : Création d'un utilisateur `dev-viewer` avec le principe du moindre privilège : il peut lire les pods (`get`, `list`), mais ne peut ni les supprimer, ni lire les secrets.
    ![E12](preuves/15-E12-rbac.png)
*   **E13 (Durcissement)** : Les conteneurs tournent en `runAsNonRoot`, avec `allowPrivilegeEscalation: false`, la suppression de toutes les capacités (`capabilities.drop: [ALL]`) et un système de fichiers en lecture seule (`readOnlyRootFilesystem`). 
*   **E14 (NetworkPolicies)** : Implémentation d'un modèle "Zero Trust". Par défaut, tout le trafic est bloqué (`default-deny`). Seuls les flux nécessaires sont ouverts (Frontend -> API, API -> DB). Un pod non autorisé est bloqué.
    ![E14 Liste](preuves/16-E14-netpol-liste.png)
    ![E14 Bloqué](preuves/17-E14-bloque.png)
    ![E14 App OK](preuves/18-E14-app-toujours-ok.png)

---

## 🛠️ Difficultés rencontrées (Troubleshooting)

*   **Problème de résolution DNS de l'initContainer** : Au départ, l'initContainer utilisait `pg_isready` avec le nom d'hôte `db`. Le pod restait bloqué en `Init:0/1` à cause de la latence de résolution DNS sur le cluster multi-nœuds. **Solution** : Remplacement de l'image par `busybox` avec la commande `nc -z -w 2 db 5432` pour un test TCP plus basique et robuste.
*   **Problème de déploiement de l'API** : Les pods API ne démarraient pas car ils étaient placés sur des nœuds n'ayant pas l'image `postgres:16-alpine` en cache pour l'initContainer. **Solution** : Simplification des tests dans l'initContainer et redéploiement forcé via `kubectl rollout restart`.

---

## 🚀 Guide de redéploiement (Pour le professeur)

Pour recréer cet environnement de zéro :

```bash
# 1. Créer le namespace et les règles de base
kubectl apply -f k8s/00-namespace/

# 2. Créer le Secret (impératif)
kubectl create secret generic db-credentials -n taches \
  --from-literal=POSTGRES_USER=taskuser \
  --from-literal=POSTGRES_PASSWORD=AmalSecret2026 \
  --from-literal=DB_USER=taskuser \
  --from-literal=DB_PASSWORD=AmalSecret2026

# 3. Config, DB et Application
kubectl apply -f k8s/10-config/
kubectl apply -f k8s/20-db/
kubectl apply -f k8s/30-app/

# 4. Exposition, Backup et Sécurité
kubectl apply -f k8s/70-ingress/
kubectl apply -f k8s/50-backup/
kubectl apply -f k8s/40-rbac/
kubectl apply -f k8s/60-netpol/ # En dernier !