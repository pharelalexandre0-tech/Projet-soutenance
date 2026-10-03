# EduSphere : application Android

Application Android d'EduSphere, séparée du site web. Elle emballe avec
[Capacitor](https://capacitorjs.com) la même interface que le site (dossier
`../frontend`), construite pour appeler directement le serveur en ligne
(`../frontend/.env.android`). Le site web, lui, ne change pas.

## Construire l'APK

Prérequis : Node.js 20+, Java 21, Android SDK (installé avec Android Studio).

```bash
npm install
npm run apk
```

L'APK est produit dans `android/app/build/outputs/apk/debug/app-debug.apk`.

- `npm run sync` : reconstruit l'interface et la copie dans le projet Android.
- `npm run ouvrir` : ouvre le projet dans Android Studio (émulateur, version signée pour le Play Store).
