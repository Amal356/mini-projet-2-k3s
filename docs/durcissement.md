# Durcissement des Pods (E13) — mesures et exceptions justifiées

## 1. Mesures appliquées

| Mesure | frontend | api | init `wait-for-db` | db (PostgreSQL) | sauvegarde / restauration |
|---|:-:|:-:|:-:|:-:|:-:|
| `runAsNonRoot: true` | ✅ (uid 101) | ✅ (uid 1000) | ✅ (uid 1000) | ✅ (uid 999) | ✅ (uid 999) |
| `allowPrivilegeEscalation: false` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `capabilities.drop: ["ALL"]` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `seccompProfile: RuntimeDefault` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `readOnlyRootFilesystem: true` | ✅ + `emptyDir` sur `/tmp` et `/var/cache/nginx` | ✅ + `emptyDir` sur `/tmp` | ✅ | ❌ **exception 1** | ✅ + `emptyDir` sur `/tmp` |
| ServiceAccount dédié, jeton non monté | `frontend-sa` | `api-sa` | — | `db-sa` | `backup-sa` |

Preuves : `preuves/22-E12-serviceaccounts.png`, `preuves/24-E13-securitycontext.png`.

## 2. Exceptions justifiées

### Exception 1 — base de données : `readOnlyRootFilesystem: false`

PostgreSQL écrit en dehors de son volume de données :

- socket Unix et fichier de verrou dans `/var/run/postgresql` ;
- fichiers temporaires (tris, statistiques) ;
- au premier démarrage, le script d'entrée de l'image écrit des fichiers d'initialisation.

Rendre la racine en lecture seule obligerait à identifier et monter un `emptyDir` sur chacun de ces chemins, avec un risque de panne de la base pour un gain limité. Le risque résiduel est compensé par : utilisateur non-root, aucune capability, pas d'élévation de privilèges, seccomp, et une base joignable **uniquement** par l'API et la sauvegarde (NetworkPolicies).

### Exception 2 — base de données : uid 999 au lieu de l'utilisateur de l'image

L'image `postgres:16-alpine` définit l'utilisateur `postgres` avec l'uid 70. Le volume a été initialisé avec l'uid 999 : le conserver (avec `fsGroup: 999`) garde les fichiers existants lisibles sans intervention sur le volume. Le processus ne tourne pas en root.

Effet visible : `psql` ne peut pas écrire son historique (`//.psql_history: Permission denied`), ce qui confirme l'absence de droits root.

### Exception 3 — un seul réplica pour la base

Répliquer PostgreSQL demande une réplication applicative (primaire / secondaire), hors du périmètre du mini-projet.

## 3. Pod Security Admission

Labels du namespace :

```yaml
pod-security.kubernetes.io/enforce: baseline
pod-security.kubernetes.io/warn: restricted
pod-security.kubernetes.io/audit: restricted
```

Test du profil `restricted` sans rien modifier (simulation côté serveur) :

```powershell
kubectl label --dry-run=server --overwrite ns taches pod-security.kubernetes.io/enforce=restricted
```

| Pods testés | Résultat avec `restricted` |
|---|---|
| frontend, api, db, sauvegarde, restauration | **conformes** : aucun avertissement (`preuves/25-E13-psa-restricted.png`) |
| Pod de test `kubectl run --image=busybox` sans `securityContext` | avertissement : `allowPrivilegeEscalation`, `capabilities`, `runAsNonRoot`, `seccompProfile` manquants (`preuves/27-E14-test-bloque.png`) |

Le namespace reste en `enforce: baseline` pour permettre les Pods de test du cours ; l'application elle-même respecte déjà le profil `restricted`.
