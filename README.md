# Mini-Projet 2 - Application 3 niveaux sécurisée et persistante

Ce projet déploie une application de gestion de tâches (Frontend Nginx + API Node.js + Base de données PostgreSQL) sur un cluster Kubernetes (k3s) de 3 nœuds (1 master, 2 agents). 

Toutes les commandes ont été exécutées à distance depuis un terminal Windows (PowerShell) configuré avec `kubectl`, sans jamais utiliser SSH pour l'administration.

## 📸 Preuves par exigence

### E1 - Image versionnée
L'image de l'API est bien versionnée (1.0.0) et est accessible par le cluster.
![E1](preuves/01-E1-image-versionnee.png)

### E2 - Namespace et Quota
Création du namespace `taches` avec les labels de sécurité (Pod Security Admission) et application d'un ResourceQuota.
![E2 Namespace](preuves/02-E2-namespace.png)
![E2 Quota](preuves/03-E2-quota.png)

### E8 - LimitRange
Application des limites par défaut pour les conteneurs.
![E8](preuves/04-E8-limitrange.png)

### E3 - ConfigMap
Externalisation de la configuration non-sensible.
![E3](preuves/05-E3-configmap.png)

### E4 - Secret
Création du Secret de manière impérative (sans stocker le mot de passe en clair) et ajout au `.gitignore`.
![E4 Secret](preuves/06-E4-secret.png)
![E4 Gitignore](preuves/07-E4-gitignore.png)

### E5 - StatefulSet pour la base de données
Déploiement de PostgreSQL avec un volume persistant (PVC) pour garantir la durabilité des données.
![E5](preuves/08-E5-db-statefulset.png)

### E6 - Persistance des données
Après suppression du pod `db-0`, Kubernetes le recrée et les données sont toujours présentes.
![E6](preuves/13-E6-persistance.png)

### E7 - Init container et Probes
L'API attend que la base de données soit prête grâce à un `initContainer` et expose des sondes `/health` et `/ready`.
![E7](preuves/09-E7-api-probes.png)

### E9 - Frontend et API déployés
L'ensemble des pods (API, Frontend, DB) tourne correctement en haute disponibilité.
![E9](preuves/10-E9-tout-est-deploye.png)

### E10 - Ingress
Exposition de l'application sur le réseau via Traefik.
![E10 Ingress](preuves/11-E10-ingress.png)
![E10 Navigateur](preuves/12-E10-navigateur.png)

### E11 - Sauvegarde planifiée
Un CronJob exécute `pg_dump` toutes les 5 minutes. Un job de test a été lancé avec succès.
![E11](preuves/14-E11-backup.png)

### E12 - RBAC (Moindre privilège)
Un utilisateur `dev-viewer` peut voir les pods, mais ne peut ni les supprimer, ni voir les secrets.
![E12](preuves/15-E12-rbac.png)

### E14 - NetworkPolicies
Application d'un `default-deny` puis ouverture des flux nécessaires uniquement (Frontend -> API -> DB).
![E14 Liste](preuves/16-E14-netpol-liste.png)
![E14 Bloqué](preuves/17-E14-bloque.png)
![E14 App OK](preuves/18-E14-app-toujours-ok.png)

## 🚀 Procédure de déploiement
1. Appliquer le namespace et les quotas : `kubectl apply -f k8s/00-namespace/`
2. Créer le secret : `kubectl create secret generic db-credentials ...`
3. Appliquer la config : `kubectl apply -f k8s/10-config/`
4. Déployer la DB : `kubectl apply -f k8s/20-db/`
5. Déployer l'app : `kubectl apply -f k8s/30-app/`
6. Appliquer l'Ingress : `kubectl apply -f k8s/70-ingress/`
7. Lancer les backups : `kubectl apply -f k8s/50-backup/`
8. Appliquer la sécurité : `kubectl apply -f k8s/40-rbac/` et `kubectl apply -f k8s/60-netpol/`
