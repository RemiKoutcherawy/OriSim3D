# OriSim3D

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/RemiKoutcherawy/OriSim3D?style=social)](https://github.com/RemiKoutcherawy/OriSim3D/stargazers)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=RemiKoutcherawy_OriSim3D&metric=alert_status)](https://sonarcloud.io/project/overview?id=RemiKoutcherawy_OriSim3D)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=RemiKoutcherawy_OriSim3D&metric=bugs)](https://sonarcloud.io/project/overview?id=RemiKoutcherawy_OriSim3D)
[![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=RemiKoutcherawy_OriSim3D&metric=vulnerabilities)](https://sonarcloud.io/project/overview?id=RemiKoutcherawy_OriSim3D)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=RemiKoutcherawy_OriSim3D&metric=security_rating)](https://sonarcloud.io/project/overview?id=RemiKoutcherawy_OriSim3D)
[![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=RemiKoutcherawy_OriSim3D&metric=reliability_rating)](https://sonarcloud.io/project/overview?id=RemiKoutcherawy_OriSim3D)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=RemiKoutcherawy_OriSim3D&metric=sqale_rating)](https://sonarcloud.io/project/overview?id=RemiKoutcherawy_OriSim3D)
[![Lines of Code](https://sonarcloud.io/api/project_badges/measure?project=RemiKoutcherawy_OriSim3D&metric=ncloc)](https://sonarcloud.io/project/overview?id=RemiKoutcherawy_OriSim3D)

**Simulateur interactif de pliage origami en 3D**

Créez des pliages, regardez le papier se plier en 3D.

**En développement !**

**[Demo](https://remikoutcherawy.github.io/demo.html)**

**[Android]([https://play.google.com/store/apps/details?id=com.remikoutcherawy.orisim3d](https://play.google.com/store/apps/details?id=rk.or.android&hl=fr))** Work in progress

**[iOS](https://apps.apple.com/fr/app/orisim3d/id690082883)** Work in progress

Avec l'aide de [Junie](https://junie.jetbrains.com) [Claude](https://claude.ai) [Jules](https://jules.google.com) [Cursor](https://cursor.com/agents) [Mistral](https://chat.mistral.ai/code) qui m'ont beaucoup aidé.

## Fonctionnalités

* Créer des plis par cliquer-glisser entre points ou plis
* Voir un pliage par cliquer-glisser une face, avec un pli sélectionné
* Visualisation 3D en temps réel

## Comparaison avec d’autres simulateurs (septembre 2026) Les fonctionnalités manquantes sont en cours...

| Critère | OriSim3D | [Origami Simulator](https://origamisimulator.org/) | [Oriedita](https://oriedita.github.io/) | [ORIPA](https://github.com/oripa/oripa) | [Origami Editor 3D](https://sourceforge.net/projects/origamieditor3d/) |
| --- | --- | --- | --- | --- | --- |
| Édition interactive | ✅ (souris) | ❌ (import SVG/FOLD) | ✅ | ✅ | ✅ |
| Visualisation 3D | ✅ (WebGL) | ✅ (WebGL) | ❌ (forme pliée 2D) | ❌ (forme pliée 2D) | ✅ |
| Simulation physique | ❌ | ✅ (GPU) | ❌ | ❌ | ❌ |
| Export 3D | ❌ (SVG) | ✅ (OBJ, STL) | ❌ (SVG, PNG…) | ✅ (OBJ) | ✅ (OpenCTM) |
| App mobile | ❌ (web) | ❌ (web) | ❌ | ✅ ([Android](https://play.google.com/store/apps/details?id=com.origamitoolbox.oripa)) | ❌ |
| Axiomes d’origami | ❌ | ❌ | ✅ (axiomes 5, 7) | ✅ (constructions) | ❌ |
| Animation pas-à-pas | ✅ | ❌ (pliage simultané) | ❌ | ❌ | ✅ (slider, GIF) |
