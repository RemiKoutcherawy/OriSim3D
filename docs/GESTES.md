# Gestes de pliage — ce qui est fait, et les pistes

Suite de `ERGONOMIE.md`, sur quatre questions : la flèche du geste, le choix de la
couche, les faces coplanaires, et les plis composés.

---

## 1. La flèche courbée *(fait)*

La flèche était un trait droit entre le point de saisie et le curseur. Elle ne disait
rien du mouvement du papier, seulement de celui de la main.

Le point de départ, c'est que **la bonne courbe n'a pas à être inventée** : la pointe
du rabat parcourt un cercle autour de la charnière, et ce cercle se projette à l'écran.
Il suffit de faire tourner une copie de la pointe par pas de quelques degrés et de
projeter chaque pas avec la matrice déjà calculée par `updateCanvasCoords()`. La flèche
obtenue part exactement d'où le papier part et arrive exactement où il arrive —
vérifié au pixel dans les tests contre la position d'arrivée réelle.

Trois détails qui font la différence entre « un arc » et « un arc de diagramme » :

- **Vu de face, la trajectoire se projette sur une droite** : le papier sort de l'écran
  et rien de la courbe ne survit. Les diagrammes dessinent l'arc quand même, parce que
  la courbe *signifie* « ça passe par la troisième dimension ». `bowArc()` complète donc
  la flèche jusqu'à une courbure lisible, avec une correction en sinus qui s'annule aux
  deux bouts — la flèche reste honnête sur son départ et son arrivée, et la correction
  ne fait rien quand la vue montre déjà une vraie courbe.
- **Vallée ou montagne** : hampe pleine et pointe pleine quand le pli vient vers
  l'observateur, hampe tiretée et pointe creuse quand il s'en éloigne. C'est la
  convention Yoshizawa–Randlett, et l'information est disponible gratuitement (le signe
  du déplacement en profondeur de la pointe à mi-course).
- **Un arc fantôme** montre où mènerait le pli complet à 180°. C'est ce qui apprend le
  geste : on voit la destination avant d'y être.

Et le geste **entraîne la formation du pli** : la rotation est appliquée au modèle
pendant le glissé. Deux précautions ont été nécessaires :

- l'aperçu est défait au `move` suivant et la décision (axe, angle, pointage) est prise
  sur la géométrie de départ — sinon l'aperçu alimente la décision qui l'a produit, et
  le pli s'emballe ;
- il est défait avant toute émission de commande, pour que l'historique ne contienne
  que l'étape animée finale. Un geste abandonné remet le papier en place.

### Ce qu'il reste à faire ici

- **Accrocher** : pendant le glissé, s'arrêter net sur 180° quand le rabat se pose à
  plat, et sur l'angle qui amène la pointe exactement sur un autre point du modèle.
  C'est le repère d'origami, et c'est là que le geste deviendrait précis.
- **Une ligne d'état** qui écrit le geste en clair avant le clic (`ERGONOMIE.md` §3.4).
  La flèche montre *où*, elle ne dit pas *quoi*.
- **Les autres flèches du vocabulaire** : double pointe pour « plier puis déplier »
  (l'étape la plus fréquente des diagrammes), flèche en boucle pour « retourner », flèche
  circulaire pour « tourner », petite flèche plate pour « enfoncer ». Chacune correspond
  à un geste qui n'existe pas encore, et les dessiner obligerait à les définir.

---

## 2. La face du dessus *(fait)*

Il y avait un bug avant l'ergonomie. `faceDepth()` renvoyait le *z œil* brut en le
documentant comme « lower = closer to camera ». Or le z œil croît vers la caméra : la
vue est à −700 et `initPerspective()` clippe entre −50 et −1200. Le tri croissant de
`pickFaces3d()` renvoyait donc **la face la plus lointaine en premier**, et c'est elle
que le geste attrapait. Le test existant ne pouvait pas le voir : il posait `zEye = -10`
et `500`, deux valeurs hors du champ visible, la seconde carrément derrière la caméra.

`faceDepth()` renvoie maintenant la distance à la caméra, ce qui rend vraie la
comparaison que faisaient déjà `pickFaces3d()` et `computeCrossedSegments()`.

Elle tient aussi compte de l'`offset`, et c'est le pont avec la question 3 :
`initBuffers()` décale chaque face de `offset` le long de sa normale, donc **sans cela
deux faces coplanaires ont exactement la même profondeur** et l'ordre de la pile est
arbitraire. Ce qui est dessiné au-dessus n'était pas ce que le curseur désignait.

Côté geste : un clic arme la couche du dessus, le « rabat avant » d'un diagramme. Un
nouveau clic sur la même pile descend d'une couche (`// selectFaces f1(0) (couche 2/2)`),
et passé la dernière la pile est relâchée. Alt prend la pile entière, ce que le clic
faisait jusqu'ici.

### Ce qu'il reste à faire ici

- **La molette serait plus directe que le clic répété.** Un essai à la souris l'a
  montré : le cycle repart de la couche du dessus dès que le clic suivant tombe un
  pixel à côté, parce que la pile désignée n'est alors plus tout à fait la même. Sur
  une pile survolée en continu, la molette n'a pas ce défaut, et elle laisse le clic
  tranquille.
- Le survol devrait déjà montrer la couche visée, avant le clic.
- **Les sélections s'accumulent d'une pile à l'autre.** Cliquer une nouvelle pile ne
  désélectionne pas les faces armées ailleurs, si bien que le journal affiche
  `// selectFaces f1(0) f3(0) (couche 1/4)` — une couche annoncée, deux faces armées.
  Ce n'est pas qu'un défaut d'affichage : le rabat part de *toutes* les faces
  sélectionnées, donc une sélection oubliée change ce qui est plié. C'est la même
  famille de piège que `priorityAxis()`, qui prend n'importe quel segment sélectionné
  du modèle (`ERGONOMIE.md` §4.9).

---

## 3. Les faces coplanaires et `offset`

### Ce que je comprends de l'existant

Deux commandes, et elles ne font pas la même chose :

- `offset d f1 f2…` fait `face.offset += d/10`, et `offset` seul remet tout à zéro.
  C'est un réglage manuel, relatif, en unités de dixièmes.
- `order f1 f0 f3` pose `face.offset = signe(nz) × rang`, la première citée devant.
  C'est une **déclaration d'ordre**, et c'est la bonne primitive.

Le rendu déplace chaque sommet de `offset × normale`. Comme la normale se retourne quand
la face se retourne, le signe d'`offset` ne veut pas dire « vers l'observateur » mais
« le long de ma propre normale » — d'où les signes opposés dans les scripts
(`offset -1 f0` puis `offset 2 f1 f3 f6`). `order` compense déjà avec `signe(nz)`.

Deux limites à signaler :

- **`order` fige une direction de vue.** Il utilise le `nz` *monde*. Dès qu'on oriente
  la vue à la souris (`view3d.angleX/angleY`, qui ne touchent pas les coordonnées
  monde), « devant » n'est plus l'axe z monde et l'ordre déclaré ne correspond plus.
- **La souris n'émet jamais d'`offset` ni d'`order`.** Tout pli fait au geste laisse des
  faces coplanaires au même offset, donc en z-fighting. `fromFaceClick()` va jusqu'à
  afficher l'offset de chaque face dans son commentaire, sans jamais le régler.

### La piste

Le décalage visuel n'est qu'un *rendu* de l'information utile, qui est **l'ordre des
couches**. Le format FOLD a exactement ça : `faceOrders`, une liste de triplets
« telle face est au-dessus de telle autre ». `ReadWrite.js` gère déjà `edges_assignment`
et `faces_vertices` mais pas `faceOrders` — l'ajouter donnerait la représentation
standard, importable et exportable.

L'ordre ne se retrouve pas en regardant la géométrie : deux faces coplanaires sont
coplanaires, point. Il faut le **tenir à jour au fil des plis**, ce qui est facile parce
que chaque pli le dit :

> quand le rabat F bascule de 180° sur le papier S, F passe entièrement au-dessus (vallée)
> ou au-dessous (montagne) de ce qu'il recouvre, **et l'ordre interne de F s'inverse**.

Un pli donne donc un paquet de contraintes « au-dessus de », qu'un tri topologique par
groupe de faces coplanaires transforme en rangs, dont `order` tire les offsets. Le calcul
du recouvrement (quelles faces de S le rabat couvre vraiment) est une intersection de
polygones dans le plan commun — la seule partie réellement nouvelle.

Deux façons de s'y prendre, par ordre d'ambition :

1. **Rangs dérivés du pli, réglés à la volée.** Après chaque pli, le geste émet un
   `order` sur le groupe coplanaire touché. Ça reste du texte dans le script, donc
   rejouable et modifiable à la main, dans la continuité de l'existant.
2. **Ordre relatif stocké, offsets calculés au rendu.** `face.offset` cesse d'être une
   donnée du modèle pour devenir une sortie de `View3d`, recalculée selon la direction
   de vue courante. Ça règle du même coup la limite « `order` fige une direction de
   vue », et ça rapproche du format FOLD.

Une remarque de méthode : maintenant que `faceDepth()` tient compte de l'`offset`, le
pointage et le rendu sont d'accord. C'est le préalable à tout le reste — sans ça, même
un ordre parfaitement calculé ne serait pas celui que le curseur suit.

---

## 4. Les plis composés

### Ce que les templates m'ont appris

Le langage sait déjà faire plusieurs rotations simultanées — plusieurs `r` dans une
même ligne `t` :

```
t 1000 r s11 -180 p1 r s15 -180 p3 a p5 p2 p7      # base carrée
t 1000 r s11  -90 p2 r s11  90 p3 a p5             # base triangulaire, même axe, angles opposés
```

Et surtout : **`adjust` est le solveur**. La plupart des plis nommés ne sont pas
plusieurs rotations, mais *une* rotation plus un `a` :

```
t 1000 r s9  180 p6  a p2        # pli du lapin
t 1000 r s9 -180 p2  a p5        # squash
t 1000 r s31 -178 p2 a p5 p7     # petal
```

On fait tourner deux ou trois points, et `adjust` tire les autres jusqu'à ce que les
longueurs 3D retrouvent celles du patron. C'est ce qui évite d'écrire un solveur
d'origami rigide.

### Ce que ça change pour le geste

En essayant de faire produire ces lignes par la souris, j'ai buté sur quelque chose
d'utile : **un pli composé est précisément un pli dont le pli ne sépare pas le papier.**

La diffusion qui calcule le rabat suppose que la charniere coupe la feuille en deux.
Dans un pli du lapin, le pli est intérieur, la feuille en fait le tour, et la diffusion
ramassait les 7 faces du modèle au lieu d'une : le geste aurait fait pivoter le modèle
entier. `isolatesFlap()` détecte le cas — si les deux faces bordant un morceau du pli se
retrouvent du même côté, le pli n'est pas une frontière — et le rabat retombe alors sur
ce que le geste désigne, la réconciliation revenant à `adjust`.

C'est un **signal exploitable par l'interface** : au survol, on sait déjà dire « ce pli
est composé ». On peut le dire à l'utilisateur au lieu de le laisser découvrir que le
modèle est parti en vrille.

Dans la foulée, `slackPoints()` remplit la liste `a` toute seule : les points auxquels
le papier reste attaché ailleurs que sur la charnière. Vide pour un pli simple, non vide
pour un pli composé — le pli du lapin passe de `r s9 180 p6 p2` à
`r s9 180 p6 p2 a p3`, de la même forme que la ligne du template.

### Les pistes, de la plus proche à la plus ambitieuse

**a. Le geste-flèche généralisé.** Le geste principal proposé dans `ERGONOMIE.md` §3.1
— attraper un point et le glisser jusqu'à sa destination — n'a pas besoin d'être adapté.
Pour un pli composé, la source et la cible déterminent toujours la rotation ; c'est
seulement l'ensemble des points à faire tourner qui n'est plus une composante connexe.
`isolatesFlap()` dit lequel des deux cas on est, donc le geste peut rester unique.

**b. Un menu contextuel au relâchement.** Quand le pli est composé, plusieurs lectures
sont possibles (squash, renversé, oreille de lapin donnent des plis différents à partir
de la même paire source/cible). Un petit menu radial au relâchement, chaque entrée
prévisualisée par son arc, éviterait de deviner. C'est aussi la façon la plus honnête de
présenter une ambiguïté réelle plutôt que de trancher au hasard.

**c. Les templates comme commandes paramétrées.** `squash <face> <axe>`,
`reverse <segment>`, `petal <face>`… Les templates deviennent l'implémentation, mais
paramétrée par des objets pointés au lieu d'indices codés en dur. Deux bénéfices : le
geste devient nommable, et le script enregistré devient lisible.

Ça bute sur un obstacle déjà identifié : les commandes désignent les objets par
**indice positionnel**, donc insérer une étape au milieu décale toute la numérotation
qui suit. Une commande paramétrée doit résoudre ses arguments à l'exécution
(« le rabat contenant cette face ») plutôt que de figer une liste d'indices. C'est le
même chantier que celui évoqué en `ERGONOMIE.md` §3.6, et il conditionne le reste.

**d. Le pli renversé comme réflexion.** Cas particulier qui se traite proprement sans
solveur : un pli renversé (intérieur ou extérieur) est la **symétrie** d'une partie du
rabat par rapport au plan du pli. Le geste « attraper la pointe et la pousser de l'autre
côté » se résout donc exactement, sans passer par `adjust`. `templates/reverse-fold.txt`
le fait aujourd'hui avec deux rotations opposées autour du même axe
(`r s7 -180 p8` puis `r s7 180 p8`), ce qui est la même chose exprimée autrement.

**e. Ce que je ne recommande pas.** Écrire un solveur d'origami rigide général. Le duo
`rotate` + `adjust` couvre déjà les plis des diagrammes, il est prévisible, et il est
déjà écrit. Le manque n'est pas dans la résolution, il est dans le geste et dans ce que
l'interface montre.

---

## Ordre de valeur, à mon avis

1. **L'accroche pendant le glissé** (180° à plat, point sur point). La flèche et
   l'aperçu sont là ; sans accroche, le geste reste imprécis, et c'est le reproche
   qui revient le plus.
2. **La ligne d'état.** Elle rend apprenable tout le reste, et coûte peu.
3. **L'ordre des couches calculé au pli.** Sans lui, tout pli fait à la souris laisse
   un modèle visuellement faux, ce qui décourage d'aller plus loin.
4. **Les commandes paramétrées** (obstacle des indices positionnels à lever d'abord),
   puis le menu au relâchement pour les plis composés.
