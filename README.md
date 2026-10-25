# Mini-projet 2 – Application trois niveaux sécurisée et persistante

**Réalisé par :** Jemli Amal (2ème année Master DevOps et Cloud Computing, ISET Tozeur)
**Environnement :** cluster k3s v1.36.4 (k3s-master, k3s-agent1, k3s-agent2). Toutes les commandes sont lancées depuis PowerShell (Windows) avec kubectl et le contexte Docker `k3s-master`.
**Application :** gestionnaire de tâches (frontend nginx, API Node.js/Express, base PostgreSQL 16)

---

### Phase 0 – Création du dépôt Git et premier push

Dépôt créé depuis PowerShell. Le fichier .gitignore exclut les secrets (secret.yaml), node_modules et l'outil local tools.ps1 ; git ls-files le confirme (exigence E4).

```powershell
git init
git add .
git ls-files
git commit -m "Initialisation du projet"
git branch -M main
git remote add origin https://github.com/Amal356/Mini-projet-2.git
git push -u origin main
git status -sb
```

![Phase 0 – Création du dépôt Git et premier push](docs/img/00-git-push.png)


### Phase 0 – Environnement

```powershell
kubectl get nodes -o wide
docker context ls
```

![Phase 0 – Environnement](docs/img/01-environnement.png)


