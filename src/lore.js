// Fiches du lore : les documents lus sur les planchettes futuristes. Une planchette = une fiche :
// l'objet LORE_ITEM + numéro (voir blocks.js) ; les anciennes (ITEMS[319]) gardent leur numéro dans
// l'usure w. On les trouve dans les coffres de l'épave du Traveler-98 (voir wreck dans gen.js).
// Texte en Markdown simple (titres #, gras **, italique *, listes -, tableaux |, traits ---).

export const LORE = {
  1: {
    title: 'Rapport de mission — Traveler-98',
    text: `# ARCHIVES SPATIALES TERRESTRES
## RAPPORT DE MISSION — TRAVELER-98

**Classification :** CONFIDENTIEL — ARCHIVES D'EXPLORATION INTERSTELLAIRE
**Année de lancement :** 2764
**Nom de code :** TRAVELER-98
**Objectif principal :** Recherche d'une planète habitable pour assurer la continuité de l'espèce humaine
**Statut du rapport :** Archive de mission

---

### 1. CONTEXTE DE LA MISSION

En l'an 2764, la Terre fait face à une situation critique concernant son avenir à long terme.

Malgré les progrès technologiques réalisés au cours des siècles précédents, les conditions environnementales terrestres, les ressources disponibles et les contraintes liées à l'expansion de la civilisation humaine imposent la recherche d'une solution durable.

Au cours des XXIe et XXIIe siècles, l'industrialisation intensive et l'utilisation massive de carburants conventionnels ont provoqué une dégradation majeure de l'atmosphère terrestre. Cette période, aujourd'hui désignée sous le nom de *Grande Crise Atmosphérique*, a durablement affecté les écosystèmes et les conditions de vie sur la planète.

Une première solution majeure a été mise en œuvre en 2305 avec l'introduction des technologies de compression des polluants.

Ces dispositifs, communément appelés **cubes de compression**, permettent d'aspirer les particules polluantes présentes dans l'atmosphère et de les condenser en blocs solides d'un volume standardisé d'un mètre cube. Cette technologie a permis d'engager un processus de dépollution à grande échelle et de restaurer progressivement une partie des écosystèmes terrestres.

Cependant, la dépollution ne suffit pas à garantir indéfiniment l'avenir de l'humanité.

Parallèlement, le développement du **Nedrolytium**, un matériau énergétique aux propriétés exceptionnelles, a révolutionné les systèmes de propulsion terrestres et spatiaux. Son utilisation permet notamment d'effectuer des décollages sans recourir aux carburants conventionnels, devenus particulièrement coûteux et dont les émissions restent incompatibles avec un environnement atmosphérique encore fragile.

Malgré ces avancées, les autorités scientifiques estiment qu'une solution de secours doit être envisagée.

La mission TRAVELER-98 est ainsi autorisée avec un objectif prioritaire : identifier une planète présentant des conditions favorables à l'installation durable d'une colonie humaine.

### 2. COMPOSITION DE L'ÉQUIPAGE

La mission TRAVELER-98 est constituée de cinq membres, sélectionnés pour leurs compétences complémentaires en matière d'exploration, de recherche scientifique, de maintenance et de survie.

**Bryan Space — Scientifique et ingénieur**

Responsable des analyses scientifiques et des systèmes techniques embarqués. Il est chargé d'évaluer les caractéristiques physiques et chimiques des planètes étudiées, ainsi que la faisabilité d'une implantation humaine.

**Ethan Bismarck — Militaire, scientifique et mécanicien**

Responsable de la sécurité de l'équipage, de l'assistance aux opérations scientifiques et de la maintenance mécanique du vaisseau. Sa polyvalence doit permettre à la mission de poursuivre ses opérations malgré les défaillances techniques éventuelles.

**Zarvin Haizen — Explorateur et archéologue**

Chargé de l'exploration des surfaces planétaires et de l'étude des éventuelles traces d'occupations anciennes. Il doit également identifier les formations géologiques et les structures susceptibles de présenter un intérêt historique ou scientifique.

**Souaï Orion — Explorateur et médecin**

Responsable de la santé physique et psychologique de l'équipage. Il participe aux opérations d'exploration et évalue les risques biologiques et environnementaux associés aux différentes planètes étudiées.

**Akhena Pink — Communications et rédaction des rapports**

Responsable des communications avec les autorités terrestres, de l'enregistrement des données de mission et de la rédaction des rapports officiels. Elle assure la conservation des observations, des décisions et des événements rencontrés durant l'expédition.

### 3. OBJECTIFS OPÉRATIONNELS

La mission TRAVELER-98 reçoit les directives suivantes :

1. Explorer les systèmes stellaires accessibles depuis la Terre avec les technologies de propulsion disponibles en 2764.
2. Identifier des planètes présentant une atmosphère, une température et des ressources compatibles avec une implantation humaine.
3. Étudier la disponibilité de l'eau, des matériaux exploitables et des sources d'énergie.
4. Évaluer les risques géologiques, atmosphériques et biologiques de chaque planète candidate.
5. Transmettre les résultats aux autorités terrestres afin de déterminer si une colonisation est envisageable.
6. Enregistrer toute découverte scientifique susceptible de contribuer à la survie et au développement futur de l'humanité.

La mission n'a pas pour objectif initial de procéder à une colonisation immédiate. Toute installation permanente devra faire l'objet d'une évaluation complémentaire et d'une autorisation spécifique.

### 4. PROTOCOLE D'EXPLORATION

Pour chaque planète identifiée, l'équipage doit effectuer une série d'observations à distance avant toute approche de sa surface.

Les analyses portent notamment sur la composition atmosphérique, la gravité, la présence d'eau liquide, les températures extrêmes et la disponibilité des ressources naturelles.

En cas de résultats favorables, une exploration de surface peut être autorisée afin de confirmer les données obtenues depuis l'orbite.

Toute anomalie géologique, structure inhabituelle ou trace potentielle d'activité biologique doit être documentée et transmise au responsable scientifique.

Les communications avec la Terre doivent être maintenues aussi régulièrement que les conditions techniques le permettent.

### 5. IMPORTANCE STRATÉGIQUE

La mission TRAVELER-98 représente une étape majeure dans l'histoire de l'exploration spatiale humaine.

Pour la première fois, une expédition de cette envergure est spécifiquement chargée de rechercher une solution de remplacement à long terme pour la Terre, plutôt que de se limiter à l'exploitation scientifique ou économique de destinations extraterrestres.

La réussite de cette mission pourrait ouvrir la voie à une nouvelle phase de l'histoire humaine : celle d'une civilisation capable de vivre au-delà de son monde d'origine.

Son échec, en revanche, retarderait considérablement les projets d'expansion interplanétaire.

L'équipage est informé de l'importance de ses responsabilités et des risques associés à une expédition de longue durée.

### 6. CONCLUSION DU RAPPORT INITIAL

Au moment de la rédaction de ce document, la mission TRAVELER-98 est déclarée opérationnelle.

Les cinq membres d'équipage ont été affectés à leurs fonctions respectives et les préparatifs de départ sont en cours de finalisation.

Le vaisseau est destiné à quitter l'espace terrestre afin d'entamer une exploration systématique des systèmes stellaires sélectionnés.

Les résultats de l'expédition devront permettre de déterminer si une planète habitable, capable d'accueillir durablement l'humanité, existe à portée des technologies actuelles.

**Fin du rapport initial.**

*Document établi par Akhena Pink — Responsable des communications et des archives de mission.*

**TRAVELER-98 — Pour l'avenir de l'humanité.**`,
  },
  2: {
    title: 'Fiche scientifique — Nédrolytium',
    text: `# FICHE SCIENTIFIQUE — NÉDROLYTIUM
*Matériau expérimental*

---

### 1. Composition théorique

| Composant | Rôle dans le Nédrolytium |
| --- | --- |
| Platine | Structure conductrice et stabilité |
| Tungstène | Résistance thermique |
| Fluorite | Stabilisation énergétique |
| Cramoisite | Réaction énergétique principale |
| Voltite | Transmission et régulation énergétique |

Proportions :
- 30 % de tungstène
- 25 % de platine
- 20 % de fluorite
- 15 % de cramoisite
- 10 % de voltite

### 2. Fonction de chaque minerai

- **Platine** : forme une structure interne capable de maintenir les autres composants.
- **Tungstène** : empêche la structure de se dégrader sous les températures extrêmes.
- **Fluorite** : permet de stabiliser les réactions énergétiques.
- **Cramoisite** : fournit la propriété énergétique particulière du matériau.
- **Voltite** : permet de contrôler et transmettre l'énergie produite.

### 3. Pourquoi cette combinaison est spéciale

Aucun de ces minerais ne possède individuellement les propriétés du Nédrolytium.

C'est leur association, suivie d'un procédé industriel très avancé, qui crée un matériau capable de convertir une énergie stockée en propulsion spatiale.

Le Nédrolytium ne constitue donc pas une source d'énergie infinie : il permet de convertir et d'exploiter efficacement une réserve énergétique.

### 4. Apparence

- Une couleur bleu nuit avec des reflets violets.
- Des veines lumineuses rougeâtres dues à la cramoisite.
- Une surface métallique hexagonale.
- Une légère émission lumineuse lorsqu'il est traversé par de l'énergie.

---

### Nédrolytium

*Matériau composite énergétique extrêmement rare.*

Le Nédrolytium est un matériau artificiel développé par les industries humaines au cours des siècles précédant les grandes missions spatiales.

Sa fabrication nécessite plusieurs minerais rares et un procédé de transformation complexe. Il est principalement utilisé dans les moteurs spatiaux de nouvelle génération, notamment celui du Destiny-InterSpace.

Sa capacité à convertir et réguler l'énergie en fait un composant essentiel des systèmes de propulsion interplanétaire.

*Document théorique — Archives scientifiques.*`,
  },
  3: {
    title: "Rapport de lancement — Traveler-98",
    text: `# RAPPORT DE MISSION — TRAVELER-98

**Classification :** Confidentiel  
**Année d'autorisation :** 2764  
**Mission :** Recherche d'une planète habitable  
**Équipage :** 5 membres

## 1. Motif de la mission

En l'an 2764, la Terre bénéficie de plusieurs siècles de progrès technologiques et de dépollution. Les technologies de compression atmosphérique ont permis de traiter une partie importante des polluants accumulés au cours des siècles précédents.

Toutefois, la restauration environnementale ne garantit pas à elle seule la pérennité de la civilisation terrestre.

La disponibilité des ressources, la dépendance aux infrastructures planétaires et les risques à long terme associés à l'habitat humain conduisent les autorités scientifiques à envisager une solution complémentaire : l'installation éventuelle d'une population humaine sur un autre monde.

La mission TRAVELER-98 est créée dans ce contexte.

Son objectif principal est d'identifier une planète présentant des conditions naturelles favorables à la vie humaine, avec suffisamment de ressources pour permettre la création d'une colonie autonome.

Il ne s'agit pas, à ce stade, d'organiser l'évacuation de la Terre. Il s'agit de déterminer si l'humanité dispose d'une seconde possibilité d'établissement.

## 2. Le rôle du Nedrolytium

Le développement du Nedrolytium a profondément transformé l'exploration spatiale.

Ce matériau permet la mise en œuvre de systèmes de propulsion capables de réduire la dépendance aux carburants conventionnels, dont le coût et les effets atmosphériques sont devenus particulièrement problématiques.

L'utilisation de cette technologie rend envisageables des missions de longue durée qui auraient auparavant nécessité des moyens logistiques beaucoup plus importants.

TRAVELER-98 fait partie de cette nouvelle génération d'expéditions.

La mission devra néanmoins surveiller sa consommation énergétique et préserver les capacités nécessaires au maintien en fonctionnement de ses systèmes vitaux.

## 3. Composition de l'équipage

**Bryan Space — Scientifique et ingénieur**

Chargé des analyses scientifiques, de l'étude des environnements planétaires et du fonctionnement des systèmes techniques.

**Ethan Bismarck — Militaire, scientifique et mécanicien**

Chargé de la sécurité, de l'assistance aux expériences scientifiques et de la maintenance du vaisseau.

**Zarvin Haizen — Explorateur et archéologue**

Chargé de la reconnaissance des surfaces, de l'exploration des sites inhabituels et de l'étude des éventuelles traces d'occupations anciennes.

**Souaï Orion — Explorateur et médecin**

Chargé de la santé de l'équipage, de la prévention des risques biologiques et de l'assistance médicale durant les opérations d'exploration.

**Akhena Pink — Communications et rapports**

Chargée des communications, de l'enregistrement des données de mission et de la rédaction des archives officielles.

## 4. Objectifs prioritaires

La mission doit :

1. Explorer des systèmes stellaires susceptibles d'abriter des planètes habitables.
2. Analyser les atmosphères, les températures et les ressources disponibles.
3. Déterminer si une présence humaine permanente serait envisageable.
4. Transmettre les résultats scientifiques aux autorités terrestres.
5. Documenter les découvertes géologiques, biologiques et archéologiques.
6. Préserver l'intégrité de l'équipage et des données recueillies.

Toute planète répondant aux critères initiaux devra faire l'objet d'une évaluation complémentaire avant qu'une colonisation puisse être autorisée.

## 5. Conclusion et autorisation

La mission TRAVELER-98 est officiellement autorisée en l'an 2764.

L'équipage est chargé d'entreprendre une expédition d'exploration interstellaire dont les résultats pourraient avoir des conséquences majeures sur l'avenir de la civilisation humaine.

La réussite de la mission ne sera pas uniquement mesurée au nombre de systèmes explorés, mais à sa capacité à identifier un monde où l'humanité pourrait établir une présence durable.

**TRAVELER-98 — À la recherche d'un second foyer.**

Fin du rapport de lancement.`,
  },
  4: {
    title: "Rapport de situation — Traveler-98",
    text: `# RAPPORT DE SITUATION — TRAVELER-98

**Date :** 2806  
**Lieu :** Système stellaire Hexa  
**Rédaction :** Akhena Pink, responsable des communications et des rapports  
**État de la mission :** Compromise  
**État de l'équipage :** À confirmer après établissement du bilan médical  
**État du vaisseau :** Gravement endommagé

## 1. Découverte du système

Après plusieurs décennies d'expédition, la mission TRAVELER-98 a atteint le système stellaire désigné sous le nom de code HEXA.

Les premières observations ont permis d'identifier une planète présentant plusieurs caractéristiques compatibles avec une implantation humaine.

Les analyses préliminaires indiquent que cette planète, désormais désignée HEXA-1 dans les relevés de mission, possède un environnement susceptible de permettre la survie humaine.

La présence de ressources naturelles exploitables et les caractéristiques observées depuis l'orbite justifient une reconnaissance plus approfondie.

L'équipage estime que ce monde pourrait répondre à plusieurs des critères établis lors du lancement de la mission.

## 2. Approche de la planète

Au cours de la phase d'approche, les systèmes de surveillance ont identifié une ceinture d'astéroïdes particulièrement dense entourant la région orbitale de la planète.

La concentration des corps célestes et leur répartition rendent la navigation extrêmement risquée.

Malgré les tentatives de correction de trajectoire, les conditions de passage se sont rapidement dégradées. Plusieurs impacts ont été enregistrés sur la structure du vaisseau.

Les dommages subis ont affecté les systèmes de navigation, les communications et les capacités de contrôle de l'appareil.

Les tentatives de stabilisation n'ont pas permis de rétablir une trajectoire sûre.

L'équipage a alors été contraint d'engager une descente d'urgence vers la surface de la planète.

## 3. Impact et conséquences

Le vaisseau TRAVELER-98 s'est écrasé à la surface de HEXA-1.

L'impact a entraîné la destruction de plusieurs sections de la structure et la défaillance de systèmes essentiels au fonctionnement du bâtiment.

À la suite du crash, le vaisseau ne peut plus être considéré comme un moyen de transport opérationnel. Les possibilités de réparation restent inconnues et devront être évaluées lorsque les conditions permettront une inspection complète.

Les communications avec la Terre ne sont plus garanties.

L'équipage doit désormais considérer sa présence sur la planète comme une situation de survie prolongée, jusqu'à ce qu'un moyen de communication fiable ou une solution de transport puisse être rétabli.

## 4. Situation de l'équipage

Les cinq membres de TRAVELER-98 ont pour priorité immédiate d'établir un bilan médical, de sécuriser les zones accessibles de l'épave et de récupérer les ressources indispensables.

Bryan Space doit évaluer les dommages techniques et identifier les équipements récupérables.

Ethan Bismarck est chargé de sécuriser les abords du site de crash et d'inspecter les systèmes mécaniques encore accessibles.

Zarvin Haizen doit participer à la reconnaissance des environs et identifier les ressources ainsi que les éventuels dangers du terrain.

Souaï Orion doit établir l'état de santé des membres de l'équipage et organiser les premiers soins.

Je suis chargée de préserver les données de mission, de documenter les événements et de tenter de rétablir les communications.

Aucune conclusion définitive ne peut encore être formulée concernant la possibilité d'un retour.

## 5. Évaluation de la planète

Malgré les circonstances de notre arrivée, HEXA-1 demeure un objet d'étude majeur.

La planète présente des caractéristiques qui pourraient permettre une installation humaine, mais les observations effectuées avant le crash ne suffisent pas à confirmer son habitabilité sur le long terme.

Une exploration de surface devra être entreprise afin d'évaluer la disponibilité de l'eau, des ressources, des matériaux de construction et des sources d'énergie.

Les relevés orbitaux devront également être comparés aux observations directes afin de déterminer si les conditions locales correspondent aux estimations initiales.

Toute exploration devra être menée avec prudence, compte tenu de l'absence actuelle de soutien extérieur.

## 6. Conclusion

La mission TRAVELER-98 a atteint son objectif initial en identifiant une planète potentiellement habitable.

Cependant, la destruction du vaisseau compromet gravement la poursuite des opérations et rend incertain tout retour vers la Terre.

La priorité n'est désormais plus la reconnaissance scientifique seule, mais la survie de l'équipage et l'établissement d'une présence viable sur la planète.

Les données recueillies jusqu'à présent doivent être préservées.

Si ce rapport est récupéré par une autre expédition, il est demandé aux éventuels intervenants de rechercher le site du crash, de localiser les membres de l'équipage et de tenter de restaurer les communications.

**Dernière entrée enregistrée — Akhena Pink**

Nous avons parcouru une distance que peu d'êtres humains auraient imaginé franchir. Nous sommes partis à la recherche d'un nouveau foyer pour notre espèce.

Nous avons trouvé un monde.

Mais nous ne savons pas encore si nous pourrons un jour le quitter.

Fin du rapport de situation.`,
  },
  5: {
    title: "Enregistrement audio n° 01 — Premier contact",
    text: `# ARCHIVES TRAVELER-98
## ENREGISTREMENT AUDIO N° 01 — PREMIER CONTACT

**Date :** 12 novembre 2806  
**Lieu :** Village inconnu, planète Hexa  
**Enregistré par :** Zarvin Haizen — Explorateur et archéologue  
**Participants :**
- Zarvin Haizen — Explorateur
- Bryan Space — Scientifique et ingénieur
- Ethan Bismarck — Militaire, scientifique et mécanicien
- Individu local non identifié — Semble être le responsable du village

**État du fichier :** Audio récupéré — Qualité moyenne  
**Classification :** Observation de terrain

---

### [DÉBUT DE L'ENREGISTREMENT]

**[00:00]**

*Bruits de pas sur un sol de terre. Quelques sons d'animaux sont audibles au loin. Le vent souffle doucement contre le microphone.*

**ZARVIN :** Enregistrement numéro un. Nous avons découvert un petit village à environ deux kilomètres du point de chute. Les habitations semblent construites principalement en bois et en pierre. Les structures sont rudimentaires, mais elles sont clairement conçues par une espèce intelligente.

*Un bruit métallique retentit derrière lui.*

**BRYAN, en arrière-plan :** Ethan, je te le dis, ce morceau vient du système de refroidissement.

**ETHAN :** Et moi, je te dis que le système de refroidissement n'a rien à voir avec le bruit que j'ai entendu.

**BRYAN :** Tu es mécanicien, pas devin.

**ETHAN :** Et toi, tu es ingénieur. Alors pourquoi est-ce qu'on est à pied ?

**ZARVIN :** Vous pouvez baisser d'un ton, tous les deux ?

**[Silence de trois secondes.]**

**ETHAN, plus bas :** Il nous entend, tu crois ?

**ZARVIN :** Je ne sais pas. Mais j'aimerais éviter de commencer notre premier contact en lui donnant l'impression qu'on se dispute.

**[00:48]**

*Un individu s'approche lentement. Il porte des vêtements simples et tient les bras près du corps. Il observe Zarvin quelques secondes, puis incline légèrement la tête.*

**VILLAGEOIS :** Moa !

**ZARVIN :** Euh… Bonjour ?

**VILLAGEOIS :** Moa ! Ha, mi ?

**ZARVIN :** Moa…

*Il reproduit le salut avec hésitation.*

**VILLAGEOIS :** Hé !

**ZARVIN :** Hé !

*Le villageois regarde Zarvin, puis tourne brièvement la tête vers les deux autres membres de l'équipage.*

**VILLAGEOIS :** No-mi.

**ZARVIN, à voix basse :** No-mi… Étranger, peut-être. Il nous a identifiés comme des étrangers.

**BRYAN, au loin :** Tu crois qu'il comprend notre langue ?

**ETHAN :** Tu peux aller lui demander.

**BRYAN :** Je te laisse cette expérience scientifique.

**[01:31]**

**ZARVIN :** Moa-va ?

*Le villageois reste immobile. Il ne semble ni effrayé ni particulièrement intéressé.*

**VILLAGEOIS :** Moa-va.

**ZARVIN :** Bienvenue… D'accord. Ça, c'est plutôt bon signe.

*Zarvin désigne sa propre poitrine.*

**ZARVIN :** Zarvin.

**VILLAGEOIS :** Ha ?

**ZARVIN :** Zarvin. Mon nom.

*Il pointe ensuite le villageois.*

**ZARVIN :** Mi ?

**VILLAGEOIS :** Mi ta.

**ZARVIN :** Mi ta… Tu travailles ?

*Le villageois regarde brièvement ses mains, puis désigne une maison située derrière lui.*

**VILLAGEOIS :** Mi do.

**ZARVIN :** Ta maison ?

**VILLAGEOIS :** Ya.

**ZARVIN :** Ya… D'accord. Peut-être que « ya » signifie oui, ou quelque chose d'approchant.

**[02:17]**

*Zarvin sort lentement un petit carnet de sa poche et dessine une maison hexagonale. Il la montre au villageois.*

**ZARVIN :** Do ?

**VILLAGEOIS :** Do ka !

*Le villageois désigne la porte de sa propre maison, puis mime le mouvement de fermeture.*

**ZARVIN :** Fermer la porte ? Do ka… Intéressant.

*Il ajoute un dessin de porte ouverte.*

**ZARVIN :** Do ou ?

**VILLAGEOIS :** Do ou !

*Le villageois semble comprendre la question. Il pointe la porte de sa maison, puis fait un geste pour inviter Zarvin à avancer.*

**VILLAGEOIS :** Va do.

**ZARVIN :** Entrer ?

*Zarvin s'arrête à quelques pas de la maison et attend une nouvelle réaction.*

**VILLAGEOIS :** Va do.

**ZARVIN :** Je vais éviter d'entrer sans être certain. On ne sait rien de leurs règles.

**ETHAN, en arrière-plan :** Enfin une décision raisonnable.

**BRYAN :** Tu veux vraiment donner ton avis sur les décisions raisonnables ?

**ETHAN :** Tu veux vraiment reparler du refroidissement ?

**BRYAN :** Non.

**[03:06]**

*Le villageois s'éloigne de quelques pas. Il s'arrête devant une petite parcelle cultivée et désigne les plantes.*

**VILLAGEOIS :** Fa nom ! Pa si !

**ZARVIN :** Fa nom… Récolter le blé. Pa si… Planter les graines.

*Il note les deux expressions dans son carnet.*

**ZARVIN :** Tu travailles dans les champs ?

**VILLAGEOIS :** Mi ta.

**ZARVIN :** Oui, je commence à reconnaître celle-là.

*Le villageois retourne tranquillement vers le centre du village. Il ne fait aucun signe particulier aux autres membres de l'équipage.*

**ZARVIN :** Observation supplémentaire : l'individu ne semble pas chercher à nous chasser, mais il ne manifeste pas non plus de curiosité particulière. Il poursuit ses activités comme si notre présence était secondaire.

**[03:49]**

**BRYAN, en arrière-plan :** Zarvin, tu as vu les bâtiments ? Les angles sont presque identiques sur toutes les maisons.

**ZARVIN :** Oui. J'ai remarqué. Les constructions sont simples, mais le village possède une organisation cohérente.

**ETHAN :** Et aucune route ne semble mener ailleurs.

**ZARVIN :** Exactement. Je n'ai repéré aucun chemin clairement entretenu vers un autre village. Cela ne prouve pas qu'ils sont seuls, mais pour le moment, nous n'avons trouvé aucune trace d'une autre communauté.

*Le villageois se retourne vers eux.*

**VILLAGEOIS :** Ha !

**ZARVIN :** Tu veux nous montrer quelque chose ?

**VILLAGEOIS :** Hé !

*Le villageois retourne à ses occupations.*

**ZARVIN :** Ou peut-être pas.

**[04:22]**

*Zarvin fait un dernier essai. Il lève la main pour saluer.*

**ZARVIN :** Moa va !

**VILLAGEOIS :** Moa va !

*Le villageois s'éloigne sans se retourner davantage.*

**ZARVIN :** Fin de l'observation. Nous avons identifié plusieurs expressions simples, mais nous ne pouvons pas encore déterminer la structure complète de leur langue. L'individu pourrait être un habitant ordinaire ou une personne ayant une fonction particulière dans le village. Nous n'avons aucune preuve qu'il en soit le chef.

*Il marque une pause.*

**ZARVIN :** Je recommande de ne pas intervenir dans leurs activités et de poursuivre les observations à distance. Pour l'instant, ils nous tolèrent. Ce serait dommage de gâcher ça.

**BRYAN, en arrière-plan :** Ethan, tu as pris les relevés du moteur ?

**ETHAN :** Oui.

**BRYAN :** Où sont-ils ?

**ETHAN :** Dans le vaisseau.

**BRYAN :** Le vaisseau est à deux kilomètres !

**ETHAN :** Alors on a une bonne raison d'y retourner.

**ZARVIN :** …Fin de l'enregistrement.

### [FIN DE L'ENREGISTREMENT — 04:58]

---

### NOTES D'ARCHIVES

- **Premier contact verbal confirmé** avec un habitant de Hexa.
- Plusieurs expressions locales ont été associées à des gestes ou à des actions observables.
- L'individu observé pourrait être un responsable local, mais son statut reste à confirmer.
- Aucun signe d'hostilité n'a été relevé durant cet échange.
- Aucune route vers un autre village n'a été identifiée lors de cette observation limitée.
- Les habitants semblent poursuivre leurs activités habituelles malgré la présence des explorateurs.

**Note finale :** Cet enregistrement constitue la première tentative documentée de communication de l'équipage TRAVELER-98 avec les habitants de Hexa.`,
  },
  6: {
    title: "Rapport technique n° 004 — Propulsion",
    text: `# ARCHIVES SPATIALES — RAPPORT TECHNIQUE N° 004

**Classification :** Technique — Accès équipage
**Date :** 17 septembre 2789
**Vaisseau :** Destiny-InterSpace
**Mission :** TRAVELER-98
**Objet :** État général du système de propulsion
**Rédigé par :** Bryan Space — Scientifique et ingénieur de bord

---

## 1. OBJET DU RAPPORT

Le présent document a pour objectif de consigner l'état du système de propulsion du *Destiny-InterSpace*, ainsi que les observations effectuées au cours des dernières opérations de maintenance.

Le système fonctionne actuellement dans les limites prévues par le constructeur. Plusieurs composants présentent néanmoins une usure supérieure aux estimations initiales, probablement due à la durée exceptionnelle de la mission.

## 2. DESCRIPTION DU MOTEUR

Le *Destiny-InterSpace* est équipé d'un moteur à propulsion au nédrolytium, conçu pour permettre les voyages spatiaux de longue durée sans dépendre des carburants conventionnels.

Le système utilise un cœur de conversion énergétique associé à plusieurs chambres de stabilisation. Le nédrolytium permet d'alimenter le processus de propulsion, tandis que les stabilisateurs régulent la puissance produite afin de limiter les contraintes exercées sur la structure du vaisseau.

Le moteur est conçu pour fonctionner pendant plusieurs décennies, à condition que les opérations de maintenance soient effectuées régulièrement.

## 3. ÉTAT DES COMPOSANTS

**Cœur de conversion :** fonctionnement nominal. Aucun défaut critique détecté.

**Chambres de stabilisation :** rendement légèrement inférieur aux valeurs enregistrées au départ. Une recalibration est recommandée lors du prochain arrêt technique.

**Circuit de refroidissement :** présence de fluctuations thermiques pendant les phases de poussée prolongée. Le problème reste maîtrisable, mais doit être surveillé.

**Système de contrôle :** fonctionnement stable. Quelques erreurs mineures ont été enregistrées dans les journaux automatiques, sans conséquence directe sur la navigation.

**Réserves énergétiques :** suffisantes pour poursuivre la mission selon le plan de vol actuel, sous réserve de maintenir les paramètres de propulsion dans les limites recommandées.

## 4. ANOMALIE OBSERVÉE

Lors du dernier essai de poussée, une variation inhabituelle a été détectée dans la fréquence de résonance du cœur de conversion.

L'anomalie n'a duré que 0,8 seconde. Elle s'est produite sans variation notable de température ni perte de puissance mesurable.

Une seconde vérification n'a pas permis de reproduire le phénomène.

À ce stade, aucune défaillance n'est confirmée. L'origine de cette variation reste inconnue. Une inspection complémentaire est prévue lors de la prochaine maintenance complète.

## 5. RECOMMANDATIONS

- Réduire les phases de poussée maximale aux seules manœuvres nécessaires.
- Contrôler les chambres de stabilisation tous les 180 jours.
- Conserver une réserve énergétique suffisante pour les corrections de trajectoire imprévues.
- Archiver toute nouvelle variation de fréquence du cœur de conversion.
- Ne pas procéder à une ouverture du cœur sans immobilisation complète du système.

## 6. CONCLUSION

Le moteur du *Destiny-InterSpace* reste opérationnel et ne présente actuellement aucun signe de défaillance imminente.

Compte tenu de la durée de la mission TRAVELER-98, une dégradation progressive de certains composants était prévisible. Les anomalies relevées ne justifient pas, pour le moment, une modification du plan de vol.

**Note personnelle — Bryan Space :**

« Un moteur peut fonctionner parfaitement pendant des années et commencer à montrer ses limites sans prévenir. Je préfère consigner une anomalie insignifiante plutôt que d'avoir à expliquer plus tard pourquoi nous l'avons ignorée. »

**Fin du rapport.**
*Document enregistré dans les archives techniques du Destiny-InterSpace.*`,
  },
  7: {
    title: "Rapport quotidien n° 012 — Fabricateur de nourriture",
    text: `**Date :** 18 avril 2807  
**Lieu :** Épave du *Destiny-InterSpace*, planète Hexa  
**Rédacteur :** Bryan Space — Scientifique et ingénieur  
**Classification :** Rapport quotidien — Archives de bord  
**Objet :** Réactivation du fabricateur de nourriture

---

## 1. ÉTAT DE LA SITUATION

Cela fait plusieurs mois que nous tentons de rendre une partie des équipements du *Destiny-InterSpace* à nouveau fonctionnelle. Malgré les dégâts causés par le crash, certains systèmes ont résisté, mais les dommages électriques et mécaniques nous empêchent de les utiliser normalement.

Aujourd'hui, j'ai enfin réussi à réactiver le fabricateur de nourriture.

C'est probablement la meilleure nouvelle que nous ayons eue depuis notre arrivée sur Hexa.

## 2. DESCRIPTION DE L'INTERVENTION

Le fabricateur était hors service depuis le crash. Le système de diagnostic signalait une défaillance du module de distribution énergétique ainsi qu'une erreur de synchronisation avec l'unité de synthèse.

Après plusieurs tentatives infructueuses, j'ai découvert que le problème ne venait pas de l'unité de synthèse elle-même, mais du contrôleur chargé de répartir l'énergie entre les différents composants.

J'ai récupéré un régulateur encore fonctionnel dans une section secondaire du vaisseau, puis adapté ses connexions au système du fabricateur.

L'opération a nécessité plusieurs heures de travail et deux redémarrages forcés.

À 16 h 42, le système a finalement accepté la séquence de démarrage complète.

**Fabricateur : OPÉRATIONNEL.**

## 3. PREMIER ESSAI

Le premier cycle de production s'est déroulé sans interruption.

Le fabricateur a produit une ration standard à partir des réserves de matière nutritive encore disponibles à bord. La texture était loin d'être agréable, mais les analyses n'ont révélé aucune anomalie susceptible de rendre le produit impropre à la consommation.

Ethan a été le premier à tester le résultat.

Sa réaction exacte a été :

« C'est officiellement le repas le moins mauvais qu'on ait mangé depuis le crash. »

Je considère que c'est un avis positif, compte tenu de nos derniers repas.

Souaï a ensuite vérifié les paramètres nutritionnels. Les résultats sont satisfaisants, même si la diversité des rations dépendra de l'état des réserves restantes.

## 4. LIMITES DU SYSTÈME

La remise en service du fabricateur ne résout pas définitivement notre problème alimentaire.

Les réserves de matière nutritive sont limitées et le système ne peut pas créer de nourriture à partir de rien. Il transforme uniquement les matières compatibles qu'il reçoit.

La production devra donc être rationnée jusqu'à ce que nous trouvions une source d'approvisionnement durable sur Hexa.

Une étude des ressources locales pourrait permettre d'identifier des matières premières compatibles, mais aucune substance provenant de l'environnement ne devra être introduite dans le fabricateur sans analyse préalable.

## 5. OBSERVATIONS COMPLÉMENTAIRES

Le système électrique reste instable dans certaines parties du vaisseau. Je recommande de ne pas faire fonctionner simultanément le fabricateur et les équipements de forte consommation énergétique avant d'avoir terminé les réparations du circuit principal.

J'ai également enregistré une copie du programme de contrôle sur un support indépendant. Si le contrôleur venait à tomber en panne, nous disposerions ainsi d'une sauvegarde.

Ce n'est pas une solution parfaite, mais c'est mieux que de devoir recommencer toute l'opération.

## 6. CONCLUSION

Le fabricateur de nourriture est de nouveau opérationnel. Cette réparation devrait améliorer notre autonomie et réduire notre dépendance aux rations immédiatement disponibles.

Pour la première fois depuis le crash, nous avons récupéré un équipement essentiel sans devoir sacrifier une autre fonction vitale du vaisseau.

Il reste énormément de travail. Le moteur ne peut toujours pas nous permettre de quitter Hexa, plusieurs compartiments sont inaccessibles et nous ne savons pas combien de temps les équipements restants tiendront.

Mais aujourd'hui, nous avons réussi quelque chose.

**Note personnelle — Bryan Space :**

« Je commence à comprendre que réparer ce vaisseau ne signifie pas forcément le remettre en état de décoller. Parfois, il suffit de faire fonctionner une seule machine pour rendre la journée un peu moins difficile. Demain, je m'occuperai du circuit électrique. Et j'espère sincèrement qu'Ethan arrêtera de critiquer mes repas maintenant que je peux enfin lui en fabriquer un. »

**Fin du rapport quotidien n° 012.**

*Document archivé dans le système de bord du Destiny-InterSpace.*`,
  },
  8: {
    title: "Document confidentiel n° 001 — Registre de l'équipage",
    text: `# ARCHIVES SPATIALES — DOCUMENT CONFIDENTIEL N° 001

**Date :** 3 juillet 2760
**Mission :** TRAVELER-98
**Rédactrice :** Leila Space — Créatrice et cheffe de mission
**Classification :** CONFIDENTIEL — DOSSIER MÉDICAL ET PERSONNEL
**Objet :** Identité, âge et suivi biologique des membres d'équipage

## 1. OBJET DU DOCUMENT

Ce registre rassemble les informations personnelles des cinq membres affectés à la mission TRAVELER-98, dont le départ est prévu en 2764.

La durée estimée de l'expédition pouvant atteindre plusieurs décennies, chaque membre sera placé en cryostase durant les phases prolongées du voyage. Ce procédé permet de ralentir considérablement les processus biologiques et de limiter le vieillissement pendant la période de suspension.

Il est donc nécessaire de distinguer l'âge civil, calculé à partir de la date de naissance, de l'âge biologique estimé, qui tient compte des périodes passées en cryostase.

## 2. REGISTRE DES MEMBRES

### Bryan Space

- **Date de naissance :** 18 avril 2730
- **Âge civil au départ :** 30 ans
- **Fonction :** Scientifique et ingénieur
- **Spécialités :** Propulsion, systèmes énergétiques et réparations complexes
- **État biologique au départ :** Conforme aux exigences médicales

### Ethan Bismarck

- **Date de naissance :** 11 février 2726
- **Âge civil au départ :** 34 ans
- **Fonction :** Militaire, scientifique et mécanicien
- **Spécialités :** Sécurité, mécanique et procédures d'urgence
- **État biologique au départ :** Conforme aux exigences médicales

### Zarvin Haizen

- **Date de naissance :** 9 mars 2735
- **Âge civil au départ :** 25 ans
- **Fonction :** Explorateur et archéologue
- **Spécialités :** Exploration, observation de terrain et étude des civilisations
- **État biologique au départ :** Conforme aux exigences médicales

### Souaï Orion

- **Date de naissance :** 15 mars 2732
- **Âge civil au départ :** 28 ans
- **Fonction :** Explorateur et médecin
- **Spécialités :** Médecine, premiers secours et analyse biologique
- **État biologique au départ :** Conforme aux exigences médicales

### Akhena Pink

- **Date de naissance :** 30 mai 2737
- **Âge civil au départ :** 23 ans
- **Fonction :** Communications et rédaction des rapports
- **Spécialités :** Télécommunications, archivage et transmission des données
- **État biologique au départ :** Conforme aux exigences médicales

## 3. PROTOCOLE DE CRYOSTASE

Les cinq membres disposent d'une capsule individuelle équipée d'un système de surveillance biologique et d'un dispositif de réveil contrôlé.

Les capsules sont programmées pour maintenir les fonctions biologiques à un niveau extrêmement réduit. Le vieillissement est ainsi fortement ralenti, sans être considéré comme absolument nul.

Les périodes d'éveil seront limitées aux opérations nécessitant une intervention humaine : maintenance, corrections techniques, vérifications médicales et situations exceptionnelles.

Le temps passé en cryostase ne doit pas être confondu avec le temps réellement vécu par un membre d'équipage.

## 4. CONCLUSION

L'âge civil des membres continuera d'augmenter au fil des années calendaires, même lorsque leur âge biologique évoluera très peu.

En cas de réveil après plusieurs décennies, un membre pourra donc être officiellement âgé de plusieurs dizaines d'années supplémentaires tout en conservant une apparence proche de celle qu'il avait au départ.

Le respect du protocole de cryostase est indispensable à la réussite de TRAVELER-98.

**Signé : Leila Space**
Créatrice et cheffe de la mission TRAVELER-98

*Fin du document — Toute diffusion non autorisée est interdite.*`,
  },
  9: {
    title: "Dossier personnel n° 002 — Bryan Space",
    text: `# ARCHIVES SPATIALES — DOSSIER PERSONNEL CONFIDENTIEL N° 002

**Date :** 4 juillet 2764  
**Sujet :** Bryan Space  
**Rédactrice :** Leila Space  
**Classification :** CONFIDENTIEL — ACCÈS RESTREINT À LA DIRECTION DE MISSION

## 1. IDENTITÉ

**Nom complet :** Bryan Space  
**Date de naissance :** 18 avril 2730  
**Âge au départ :** 34 ans  
**Fonction au sein de TRAVELER-98 :** Scientifique et ingénieur  
**Lien avec la rédactrice :** Époux

## 2. COMPÉTENCES ET AFFECTATION

Bryan Space possède une expertise approfondie dans les systèmes de propulsion au nédrolytium, la conversion énergétique et la maintenance des équipements spatiaux.

Il a participé à plusieurs phases de préparation technique de TRAVELER-98, notamment aux vérifications du moteur principal du *Destiny-InterSpace* et à l'évaluation de ses capacités de fonctionnement prolongé.

Sa connaissance du système de propulsion constitue un élément important de la mission. En cas de panne majeure, son intervention pourrait être déterminante pour préserver le vaisseau et ses occupants.

## 3. ÉVALUATION MÉDICALE ET CRYOSTASE

L'examen médical réalisé avant le départ ne révèle aucune contre-indication majeure à l'utilisation prolongée des capsules de cryostase.

Bryan devrait conserver un âge biologique proche de celui enregistré avant le départ pendant les périodes de suspension, sous réserve du bon fonctionnement des équipements.

La mission étant prévue pour durer plusieurs décennies, son âge civil à l'arrivée sera nettement supérieur à son âge biologique estimé.

À titre prévisionnel, si Bryan atteint Hexa en 2806 après 42 années calendaires, son âge civil sera de 76 ans. Son âge biologique devrait toutefois rester proche de 34 ans, auquel s'ajoutera le temps cumulé passé éveillé ainsi que les éventuels effets du protocole de cryostase.

Cette estimation demeure conditionnelle au respect des paramètres médicaux durant l'expédition.

## 4. ÉVALUATION PERSONNELLE

Bryan est rigoureux, méthodique et particulièrement investi dans son travail. Il a tendance à privilégier la résolution d'un problème technique avant de reconnaître ses propres limites.

Cette qualité est utile dans le cadre d'une mission aussi longue, mais elle pourrait également devenir un risque si une situation exigeait de renoncer à une réparation ou de demander de l'aide.

Il est recommandé que les procédures de maintenance imposent une vérification croisée des interventions critiques, même lorsque Bryan estime pouvoir les effectuer seul.

## 5. NOTE PERSONNELLE DE LA RÉDACTRICE

Ce document est confidentiel et ne fait pas partie des rapports ordinaires transmis à l'ensemble de l'équipage.

En tant que cheffe de mission, je dois évaluer Bryan avec la même rigueur que les autres membres. En tant que son épouse, je suis consciente que cette évaluation ne peut être entièrement dépourvue de dimension personnelle.

Je ne souhaite ni surestimer ses capacités ni les minimiser en raison de notre relation.

Je lui fais confiance pour accomplir sa mission. Je souhaite également que l'équipe comprenne qu'aucune compétence technique ne rend une personne indispensable au point de devoir tout risquer seule.

**Conclusion :** Bryan Space est apte à participer à TRAVELER-98. Son expertise représente un atout majeur pour la mission, sous réserve du respect des procédures de sécurité et de maintenance.

**Signé : Leila Space**  
Créatrice et cheffe de la mission TRAVELER-98

*Fin du dossier — Consultation soumise à autorisation.*`,
  },
};

// Planchette corrompue : ce qu'il en reste
export const CORRUPTED = `# ▓▓▓ DONNÉES CORROMPUES ▓▓▓

*Secteur de mémoire endommagé — lecture impossible.*

---

▒▒░ ERR 0x7F3A ░▒▒ … TRAVELER-98 … ▒▒▓▓░░ … journal de bord … ░▒▓

*Une réparation des archives sera peut-être possible un jour.*`;

// Markdown simple -> HTML (le texte est échappé : rien n'y est interprété comme du code)
export function loreHtml(md) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>');
  const out = [];
  let list = null, table = null, para = [];
  const flush = () => {
    if (para.length) { out.push('<p>' + para.map(inline).join('<br>') + '</p>'); para = []; }
    if (list) { out.push(`<${list.tag}>` + list.items.map((i) => '<li>' + inline(i) + '</li>').join('') + `</${list.tag}>`); list = null; }
    if (table) {
      const [head, ...rows] = table.filter((r) => !/^[\s|:-]+$/.test(r.join('')));
      out.push('<table><tr>' + head.map((c) => '<th>' + inline(c) + '</th>').join('') + '</tr>' + rows.map((r) => '<tr>' + r.map((c) => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('') + '</table>');
      table = null;
    }
  };
  for (const raw of md.split('\n')) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) { flush(); out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); continue; }
    if (/^---+$/.test(line)) { flush(); out.push('<hr>'); continue; }
    if (line.startsWith('|')) { if (!table) { flush(); table = []; } table.push(line.replace(/^\||\|$/g, '').split('|').map((c) => c.trim())); continue; }
    const li = /^(-|\d+\.)\s+(.*)$/.exec(line);
    if (li) {
      const tag = li[1] === '-' ? 'ul' : 'ol';
      if (!list || list.tag !== tag) { flush(); list = { tag, items: [] }; }
      list.items.push(li[2]);
      continue;
    }
    if (list || table) flush();
    para.push(line);
  }
  flush();
  return out.join('');
}
