# Helper.js — analyse d'ergonomie et d'implémentation

Objectif visé : **reproduire à la souris un origami lu dans un diagramme** (PDF, GIF,
suite de dessins avec des flèches : rabattre, plier suivant la diagonale, ouvrir,
retourner…).

Ce document part de ce que demande un diagramme, montre où `Helper.js` s'en écarte,
puis descend au niveau du code. Toutes les affirmations marquées « mesuré » ont été
vérifiées en exécutant le code (protocole en annexe).

---

## 1. Le décalage de fond

Une instruction de diagramme est toujours composée des quatre mêmes éléments :

| Élément du diagramme | Exemple | Ce que Helper.js demande aujourd'hui |
| --- | --- | --- |
| **1. la ligne de pli** | « suivant la diagonale » | 5 gestes différents produisant 5 commandes différentes, choisies par des conditions implicites |
| **2. les couches qui bougent** | « le rabat avant », « les deux épaisseurs » | sélectionner à la main chaque face — et même là, seule la face saisie bouge réellement |
| **3. le sens et l'amplitude** | vallée, à plat (180°) | un rapport de distances qui n'est pas un angle |
| **4. la cible** | « amener le coin A sur le point B » | n'existe pas |

Le point (2) et le point (3) sont cassés, pas seulement peu pratiques. C'est la raison
principale du « manque d'ergonomie » ressenti : le geste ne peut pas exprimer
l'instruction. Tout le reste en découle.

---

## 2. Ergonomie — problèmes de haut niveau

### 2.1 La notion de *rabat* n'existe pas — le papier se déchire

`rotatePointIds()` construit la liste des points à faire tourner à partir des faces
**sélectionnées** plus la face saisie, et rien d'autre. Il n'y a aucun parcours du
graphe d'adjacence des faces.

Conséquence mesurée : une feuille pliée en deux verticalement, dont la moitié gauche
est elle-même creusée en deux faces, donne un rabat gauche de 2 faces et 3 points hors
charnière. En saisissant une des deux faces et en pliant :

```
émis :        t 1000 r s6 180 p7 p3 // f0
devrait bouger : p0 p3 p7
laissé sur place : p0
```

`p0` reste en arrière : le papier se déchire. Pour que le pli soit correct il faut
avoir cliqué au préalable sur **chacune** des faces du rabat. Sur un modèle réel
(la cocotte fait 32 faces) c'est inapplicable, et c'est exactement pourquoi tous les
scripts de `models/` énumèrent les points à la main :

```
t 100 r s28 -180 p19 p5 p7 p22 p2 p14 p15 p18 p23 r s38 -170 p3
```

**Le rabat est calculable** : à partir de la face saisie, parcourir les faces voisines
en s'interdisant de traverser le ou les segments de la charnière. C'est un simple
remplissage par diffusion sur `Model.incidentFaces` / `Model.sharedSegments`, qui
existent déjà. C'est le changement qui a le plus d'effet sur l'ergonomie, et de loin.

### 2.2 L'angle de pli n'est pas un angle

`rotationLabel()` ne calcule pas une rotation. Il calcule le rapport entre la distance
du curseur à l'axe et la distance du **centre de gravité de la face** à l'axe, puis
mappe ce rapport sur `(rapport - 1) x 180`.

Trois conséquences, toutes mesurées :

1. **L'angle dépend de la position absolue du curseur, pas du déplacement.** Il n'y a
   aucun lien avec l'endroit où l'on a attrapé le papier. On ne manipule rien, on
   désigne une abscisse.
2. **La sensibilité varie d'un facteur 30 selon l'endroit du clic** :

   | distance du curseur à la charnière | un déplacement de 10 px donne | 180° atteint après |
   | --- | --- | --- |
   | 200 px | 10° | 196 px |
   | 50 px | 140° | 46 px |
   | 10 px | 180° | 6 px |
   | 2 px | 170° | 0 px |

   Attraper une face près de sa charnière et bouger de 13 px la replie complètement.
3. **L'angle est quantifié à 10°** et vaut 0 en dessous de 10°. Les seules valeurs
   atteignables sont `0 10 20 … 180`. 22,5° et 45° précis sont hors de portée, et
   `Math.abs(angle) < 10 ? 0` fait qu'un petit geste ne plie pas *du tout* — il retombe
   alors sur `splitSegments()` et **trace des plis** à la place, sans prévenir.

Le cas le plus parlant est le geste le plus courant de tout l'origami. Marquer le pli
médian, armer la moitié basse, l'attraper à 100 px du pli et la glisser de 200 px
jusqu'à sa position miroir — « plier en deux » :

```
émis :  split s6 0.5          angle annoncé : 0°
```

Zéro degré, et un pli tracé à la place. Le rapport prend une valeur absolue, si bien
que la position miroir — celle où le pli est exactement terminé — donne un rapport de
1, c'est-à-dire la même valeur qu'au point de départ, c'est-à-dire 0°. La loi renvoie
0 précisément là où elle devrait renvoyer 180.

Le modèle correct est la manipulation directe : le point saisi tourne sur un cercle
autour de l'axe ; l'angle est celui qui rapproche le plus ce cercle du curseur. Vu de
face, la projection écran de ce cercle donne `d(θ) ≈ d₀·cos θ`, donc
`θ = ±acos(d/d₀)` où `d₀` est la distance signée du **point de saisie** à l'axe. Le
papier suit alors la main, 90° et 180° sont des positions naturellement atteignables,
et la sensibilité ne dépend plus de l'endroit du clic.

### 2.3 On plie à l'aveugle

Pendant le glissé, le modèle n'est pas modifié : seule une flèche est dessinée sur
l'overlay. Le résultat n'apparaît qu'au relâchement, via une animation de 1000 ms. On
ne voit donc jamais ce qu'on est en train de faire, alors que c'est précisément
l'information dont on a besoin pour viser un repère.

L'infrastructure est pourtant là : `Model.snapshotPositions()` / `restorePositions()`
permettent d'appliquer la rotation à chaque `move`, de rendre la vue, et de restaurer
au geste suivant. La commande animée reste émise au relâchement, pour le script.

### 2.4 Des modes invisibles

Trois modes implicites, aucun n'est affiché :

- **« la face doit déjà être sélectionnée pour pouvoir être pliée »** (`foldAxis()`
  renvoie `undefined` si `!downFace.select`). Le premier glissé arme, le second plie.
  Rien ne le signale, et rien ne distingue à l'écran une face armée d'une face
  simplement sélectionnée.
- **« si une face quelconque est sélectionnée, les gestes de traçage sont
  désactivés »** — `fromPoint()` et `fromSegment()` font un `return` muet. Un état
  global invisible avale silencieusement les entrées.
- **« glisser une face non sélectionnée trace des plis si le geste croise du
  papier, sinon sélectionne »**. Le même geste a trois issues selon le contexte.

### 2.5 Le vocabulaire de gestes est saturé et jamais annoncé

Neuf significations sont empilées sur « appuyer, bouger, relâcher », départagées par
le type de l'objet de départ et d'arrivée :

point→point, point→segment, segment→point, segment→segment, point sélectionné en 3D,
face armée, face non armée, vide→orbite, bouton droit→translation.

Deux problèmes distincts :

- **Rien n'annonce le résultat avant le relâchement.** Il y a bien une flèche verte
  (traçage) ou ambre creuse (pli), mais elle ne dit ni *quelle* commande, ni *quel*
  axe, ni *quelles* couches.
- **Le choix entre deux commandes est fait par une condition cachée.** Glisser d'un
  point à un autre émet `across` s'il existe déjà une arête entre eux, `by` sinon.
  Or l'attente naturelle — celle du diagramme — est l'inverse : une flèche d'un coin
  vers un autre coin veut dire « amène ce coin sur celui-là », c'est-à-dire `across`.

Les touches modificatrices (Maj, Alt, Ctrl) ne sont utilisées nulle part : c'est de la
place libre pour désambiguïser explicitement au lieu de deviner.

### 2.6 Aucune accroche aux repères

L'origami se fait entièrement par repères : coin sur coin, bord sur bord, bord sur la
médiane. Le modèle a bien un `snapPoints()`, mais il s'applique *après coup*, sur les
coordonnées ; le **geste**, lui, n'accroche rien. Il n'y a aucune aide pour terminer un
glissé exactement sur un point, ni pour s'arrêter exactement à 180°.

### 2.7 L'empilement des couches est à la charge de l'utilisateur

Tous les scripts appellent `offset` avant chaque pli (`offset -1 f3 f0`) pour éviter
que les faces superposées ne clignotent. La souris n'émet **jamais** d'`offset` :
`fromFaceClick()` va jusqu'à afficher l'offset de chaque face dans le commentaire
`// selectFaces f0(0)`, mais ne le règle pas. Tout pli fait à la souris produit donc
des faces coplanaires en z-fighting.

L'information nécessaire est pourtant connue au moment du pli : le rabat qui bouge
passe au-dessus (vallée) ou en dessous (montagne) du papier resté en place.

### 2.8 Annuler : granularité et perte de sélection

- Un geste souris peut émettre plusieurs commandes (`split`, `split`, puis `t … r …`),
  et chacune est un cran d'annulation distinct. Un « pas » utilisateur ≠ un `undo`.
- **`undo` efface la sélection** : `Model.serialize()` exclut explicitement `select` et
  `hover`. Après une annulation il faut tout re-sélectionner. Mesuré.
- La pile est décalée d'un cran : après deux commandes, une seule est annulable
  (`command()` dépile *avant* que `runUndo()` ne restaure). Mesuré.
- Il n'y a pas de `redo`, pas d'`Échap` pour abandonner un glissé en cours.
- `Ctrl+Z` est géré à deux endroits (`Helper.keydown` sur `document` et
  `CommandArea.keydown` avec `stopPropagation`), et comme `CommandArea.addLine()`
  appelle `focus()` à chaque commande, c'est presque toujours le second qui gagne.

### 2.9 La même geste ne fait pas la même chose dans les deux vues

`sendCmd()` suffixe la commande par `2d` ou `3d` selon le canevas survolé. Le même
glissé produit `by2d` ou `by3d`, qui sont deux géométries différentes. L'utilisateur
doit se souvenir en permanence de quelle moitié de l'écran il est parti.

Une répartition franche serait plus lisible : **vue 2D = éditeur de patron** (on y
trace, uniquement), **vue 3D = pliage** (on y plie, uniquement). C'est aussi la
distinction que font les origamistes entre *crease pattern* et *diagramme*.

---

## 3. Proposition : deux verbes, une flèche

### 3.1 Le geste-flèche comme geste principal

Le fichier `Arrow.svg` du dépôt est la flèche de pliage classique. C'est le bon
modèle mental, et il devrait être le geste **primaire** :

> **glisser d'un point du papier vers l'endroit où ce point doit arriver.**

Ce geste se suffit à lui-même, sans sélection préalable ni mode :

- la **source** identifie le rabat (composante connexe de faces contenant ce point) ;
- la **cible** détermine à la fois la ligne de pli (médiatrice de source→cible,
  restreinte au rabat) **et** l'angle (celui qui fait exactement atterrir la source
  sur la cible) ;
- le sens vallée/montagne se déduit de la face saisie.

Il se traduit dans le langage existant par `across` + `r <axe> 180 <points>` — aucune
nouvelle primitive géométrique n'est nécessaire.

### 3.2 Les deux verbes

| Verbe | Geste | Sens origami |
| --- | --- | --- |
| **Tracer** | glisser entre deux repères, avec Maj | marquer un pli sans plier |
| **Plier** | glisser un point vers sa destination | rabattre |

Et un raccourci qui manque cruellement, parce qu'il correspond à la majorité des
étapes de diagramme (« plier suivant le pli que vous venez de marquer ») :

> **cliquer sur un pli existant = plier / déplier le long de ce pli** (bascule 0 ↔ 180°).

### 3.3 Choisir la couche

« Le rabat avant » contre « les deux épaisseurs » est *la* distinction de l'origami.
Quand plusieurs faces sont empilées sous le curseur, la molette (ou des clics
successifs) devrait faire défiler la couche saisie, celle-ci étant surlignée. C'est
découvrable, et ça remplace la sélection manuelle multi-faces.

`pickFaces3d()` trie déjà les faces par profondeur : la moitié du travail est faite.

### 3.4 Dire ce qui va se passer

Le gain le plus important par rapport à son coût : **une ligne d'état** qui se met à
jour au survol, *avant* tout clic.

```
Rabattre le rabat f3 f7 f9 sur le pli s12 — 180° — vallée
```

Un vocabulaire de gestes surchargé devient apprenable dès lors qu'il s'annonce. C'est
aussi ce qui rend l'aperçu honnête (cf. §4.3).

### 3.5 Accrocher

Pendant le glissé, accrocher aux repères : points du modèle proches du curseur,
angles remarquables (0, 45, 90, 135, 180), position où le point saisi atterrit
exactement sur un autre point. Avec un retour visuel sur le repère accroché.

### 3.6 Rendre les scripts enregistrés réutilisables

Les commandes émises désignent les objets par leur **indice positionnel**
(`r s6 180 p7 p3`). Or insérer une étape au milieu d'un script décale toute la
numérotation qui suit : un script enregistré à la souris n'est pratiquement pas
éditable, alors que c'est le mode de travail visé (souris → console → retouche →
rejeu).

Une commande de plus haut niveau, qui résout le rabat à l'exécution plutôt que de
figer une liste d'indices, rendrait les scripts robustes et lisibles :

```
fold s6 180 f0        # plier de 180° le rabat contenant f0, autour de s6
```

C'est aussi ce qui permettrait à `writeDiagrams` de produire des légendes
compréhensibles.

---

## 4. Implémentation — défauts de bas niveau

### 4.1 Il n'y a pas de machine à états, mais vingt champs

`Helper` porte `downPoint(s)`, `downSegment(s)`, `downFace(s)`, `upPoint(s)`,
`upSegment(s)`, `upFace(s)`, `firstX/Y`, `currentX/Y`, `currentSegment`,
`currentCanvas`, `moving`, `label`, `touchTime`, `lastClickPoints`… et la même cascade
`if (downPoint) … else if (downSegment) … else if (downFace)` est réécrite dans
`move()`, dans `up()` et implicitement dans `draw()`.

La conséquence n'est pas esthétique, elle est fonctionnelle : **l'aperçu et la
validation calculent la décision deux fois, à partir d'entrées différentes**, donc
l'aperçu peut mentir (§4.3).

La forme cible est un objet `Gesture` créé au `pointerdown`, qui recalcule à chaque
`move` une **intention** unique — `{verbe, axe, rabat, angle, cible, libellé}` — et que
`draw()`, la ligne d'état et `commit()` consomment tous les trois. Une seule source de
vérité.

### 4.2 `pointerType` n'est jamais mis à jour

`this.pointerType = 'mouse'` est affecté dans le constructeur et **nulle part
ailleurs**. `clickThreshold()` renvoie donc toujours 12 px : la branche tactile
(`CLICK_PX_TOUCH = 24`) est du code mort. Il suffit de lire `event.pointerType` dans
`down2d` / `down3d`.

### 4.3 L'aperçu peut promettre un pli qui n'aura pas lieu

`willFold()` (appelé par `draw()`) interroge `foldAxis(this.currentSegment)`, alors que
`fromFaceDrag()` (appelé par `up()`) interroge `foldAxis(this.upSegment)`. Or
`up()` met `upSegment` à `[]` dès qu'un point se trouve aussi sous le curseur, et
`fromFaceDrag()` commence par `if (this.upPoint) return;`.

Mesuré : glissé sur une face armée, relâché sur un coin — l'aperçu affiche la flèche
ambre et l'étiquette « 140° », et le relâchement **n'émet rien du tout**.

Le garde-fou `if (this.upPoint) return false;` en tête de `willFold()` est inopérant :
`upPoint` n'est renseigné que dans `up()`, et `out()` l'efface aussitôt, donc il vaut
toujours `undefined` pendant l'aperçu.

C'est d'autant plus gênant que viser un repère est le geste naturel : on relâche
*volontairement* sur un point.

### 4.4 L'orbite 3D s'interrompt quand on survole le papier

Dans `move3d()`, la décision « orbiter » est reprise à chaque événement à partir de ce
qui se trouve sous le curseur *à cet instant* :

```js
if (points.length === 0 && segments.length === 0 && faces.length === 0
    && event.buttons === 1
    && !this.downPoint && !this.downSegment && !this.downFace) {
```

Une orbite commencée dans le vide s'arrête donc dès que le curseur passe au-dessus du
modèle, puis reprend en sortant. La décision doit être **verrouillée au `pointerdown`**.
Symétriquement, il n'existe aucun moyen d'orbiter quand le curseur démarre sur le
papier — un modificateur (barre d'espace ou bouton du milieu) réglerait le cas.

### 4.5 Pas de capture du pointeur sur l'overlay 3D

`setPointerCapture` n'est posé que sur `canvas2d`. Un glissé 3D qui sort du canevas
ne reçoit jamais son `pointerup` : `downFace` reste actif et le geste suivant repart
d'un état corrompu.

### 4.6 Deux fonctions sans rapport partagent `touchTime`

`doubleClick()` (double-clic dans le vide = réinitialiser la vue) et
`isDoubleClickPoints()` (double-clic sur un point = `adjust`) écrivent et lisent le
même champ `this.touchTime`.

Mesuré : cliquer une fois sur un point, puis une seule fois dans le vide dans les
400 ms qui suivent **réinitialise toute la vue 3D** (angles, translation, zoom) et émet
`fit`. Un simple clic, pas un double-clic.

### 4.7 La zone de clic des points est un losange

`search2d()` sélectionne les points avec une distance de Manhattan
(`Math.abs(dx) + Math.abs(dy) < 10/scale`) mais les segments avec une distance
euclidienne. La zone sensible d'un point est donc un losange : mesuré, 9 px dans l'axe
touchent, 7 px en diagonale (soit 9,9 px de distance réelle) ne touchent pas. Le
pointage paraît irrégulier sans raison visible. Même chose dans `search3d()`.

### 4.8 `isClick()` n'utilise pas les coordonnées du relâchement

`isClick()` compare `firstX/Y` à `currentX/Y`, or `currentX/Y` n'est mis à jour que
par `move()`. `up2d()` / `up3d()` recalculent pourtant la position du relâchement sans
la reporter. Si le dernier `pointermove` est perdu ou fusionné, un glissé est pris pour
un clic.

### 4.9 Fuites d'abstraction et détails

- `event2d()` / `eventCanvas3d()` contiennent `if (!(event instanceof Event)) return event; // Used for test` :
  une couture de test câblée dans le code de production. Une fonction pure
  `(clientX, clientY, rect, view) → coords` testable directement supprimerait le besoin.
- `foldAlong()` termine par `clearSelection()` : toute la sélection est perdue après
  *chaque* pli. Plier, déplier, replier sur le même axe — enchaînement très courant —
  impose de tout re-sélectionner à chaque fois.
- `priorityAxis()` retourne `selectedAxis()`, c'est-à-dire **le premier segment
  sélectionné du modèle entier**. Un segment sélectionné par mégarde détourne
  silencieusement tous les plis suivants.
- `nearestBorderSegment()` ne cherche que parmi les arêtes de la **seule face saisie**.
  On ne peut donc pas plier autour d'un pli qui appartient à une autre face du rabat.
- Les constantes de pointage sont éparpillées (`10/scale`, `6/scale`, `12`, `24`, `1000` ms,
  `18`, `HEAD_LEN 24`…). Un objet de configuration unique les rendrait réglables.
- `computeCrossedSegments()` appelle `searchFacesWithAB()` par segment, soit
  O(segments × faces × points) à chaque relâchement. Acceptable aujourd'hui, à
  surveiller.
- **Non-problème, vérifié** : `helper.id()` fait deux balayages linéaires, mais mesuré
  à 2 µs pour l'ensemble des points de la cocotte. Inutile d'optimiser.
- La pile d'annulation n'est pas bornée : `Model.serialize()` produit du JSON complet
  à chaque commande (4,2 Kio par instantané pour la cocotte, 0,27 Mio pour rejouer le
  script). Sans plafond, une longue session grossit indéfiniment.

---

## 5. Plan de mise en œuvre

Par ordre décroissant de gain ergonomique par unité de risque.

**Étape 1 — réparer ce qui est cassé** *(fait dans cette branche, voir §6)*
Rabat par diffusion, angle en manipulation directe, cohérence aperçu/validation, et
les défauts d'entrée (§4.2 à §4.8). Aucun changement d'architecture.

**Étape 2 — dire ce qui va se passer**
Une intention unique calculée à chaque `move`, consommée par `draw()`, par une ligne
d'état, et par `commit()`. C'est le préalable à tout le reste, et cela supprime par
construction toute la classe de bugs « l'aperçu ment ».

**Étape 3 — aperçu réel et accroche**
Appliquer la rotation au modèle pendant le glissé (`snapshotPositions` /
`restorePositions`), accrocher aux points et aux angles remarquables.

**Étape 4 — le geste-flèche et le choix de couche**
Glisser un point sur sa destination ; molette pour choisir la couche dans une pile ;
clic sur un pli pour plier/déplier. Retrait progressif du mode « armer puis plier ».

**Étape 5 — empilement automatique et scripts robustes**
Émettre `offset` en même temps que le pli ; commande `fold` de haut niveau résolvant
le rabat à l'exécution.

---

## 6. Ce qui est corrigé dans cette branche

Les défauts démontrables ci-dessus, chacun accompagné d'un test :

| § | Correction |
| --- | --- |
| 2.1 | le rabat est calculé par diffusion sur le graphe des faces, sans traverser la charnière |
| 2.2 | l'angle devient une vraie rotation, relative au point de saisie, au degré près, avec accroche sur 0/45/90/135/180 |
| 4.2 | `pointerType` est lu sur l'événement |
| 4.3 | l'aperçu et la validation partagent la même décision |
| 4.4 | la décision d'orbiter est verrouillée au `pointerdown` |
| 4.5 | capture du pointeur sur l'overlay 3D |
| 4.6 | deux minuteurs distincts pour les deux double-clics |
| 4.7 | pointage euclidien, cohérent entre points et segments |
| 4.8 | `isClick()` utilise la position du relâchement |

Le seuil de clic est en outre pris en compte par l'aperçu, qui l'ignorait : un glissé
plus court que le seuil affichait une flèche de pli alors que `up()` le traitait comme
un clic.

Les points 2.3 à 2.9 et 4.1, 4.9 relèvent d'un changement de conception : ils sont
décrits ici mais **non implémentés**.

### Avant / après, sur la même séquence

La séquence « plier en deux, puis replier le rabat gauche par-dessus », jouée
uniquement par l'API de gestes de `Helper`, sans navigateur :

| Étape | `master` | branche |
| --- | --- | --- |
| tracer le pli médian | `by2d p4 p5` | `by2d p4 p5` |
| plier en deux | annonce 0°, émet `split s6 0.5` | annonce −180°, émet `t 1000 r s6 -180 p0 p1` |
| moitiés superposées | non | oui |
| tracer le pli vertical | jamais atteint | `by2d p6 p7` |
| replier le rabat gauche (2 faces, 1 face armée) | jamais atteint | `t 1000 r s11 -180 p0 p5 p3 // f0 f1` |

Les scripts livrés (`models/`, `templates/`) rejouent à l'identique : `Command.js` et
`Model.js` ne sont pas touchés, seul le chemin souris change.

---

## Annexe — protocole de mesure

Les mesures ont été obtenues en pilotant `Helper` directement sous Deno, sans
navigateur, sur un modèle `Model().init(200, 200)` :

- **§2.1** feuille coupée en `x = 0` puis moitié gauche coupée en `y = 0` ; saisie
  d'une des deux faces gauches, `rotatePoints(axe, 180)` ; comparaison de la liste
  émise avec les points de `xf < 0`.
- **§2.2** face armée, charnière = bord supérieur ; balayage du curseur et relevé de
  `helper.label` pour quatre distances de départ.
- **§2.8** deux `by2d` successifs puis `undo`, en drainant `command.anim()`.
- **§4.3** glissé sur face armée relâché sur un coin ; comparaison de `willFold()`
  avant relâchement et des commandes émises après.
- **§4.6** clic sur un point puis clic unique dans le vide ; relevé de l'état de la vue.
- **§4.7** `search2d()` à 9 px dans l'axe et à (7, 7) px.
- **§4.9** `serialize()` et `command.done` après rejeu de `models/cocotte.txt`.
