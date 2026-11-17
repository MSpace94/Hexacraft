// Exemple : le système Nyx, une étoile violette et son compagnon, une étoile à neutrons rouge.
// actif: false : il n'est que dans l'atelier. Mets true pour l'ajouter à l'univers du jeu.
// Tous les paramètres possibles : voir _modele.js.
export default {
  id: 'nyx',
  nom: 'Nyx',
  actif: false,
  description: 'Une étoile violette et une étoile à neutrons rouge qui tournent ensemble.',
  position: { distance: 18, direction: 140, hauteur: 6 },

  etoiles: [
    { id: 'nyx-a', nom: 'Nyx', type: 'naine-orange', couleur: '#c48aff', couronne: '#7a28ff', taille: 0.9, eclat: 0.8 },
    { id: 'nyx-b', nom: 'Nyx B', type: 'neutrons', couleur: 'rouge neutron', couronne: '#ff2050',
      orbite: { autour: 'nyx-a', distance: 0.12, barycentre: true } },
  ],

  planetes: [
    {
      id: 'velia', nom: 'Vélia', type: 'rocheuse', autour: 'centre', distance: 1.3, taille: 1.1, jour: 1.2, inclinaison: 18, temperature: 14,
      description: 'Un monde tempéré au ciel violet : forêts de bouleaux, prairies de mousse, déserts ocre et glaciers.',
      atmosphere: { respirable: true, ciel: '#5a3aa8', horizon: '#e8d8ff', densite: 1.1 },
      terrain: {
        base: 62, relief: 26, continents: 2200,
        mer: { niveau: 56, liquide: 'eau', gel: 'Glace', gelSous: -2, plage: 'Sable', fond: 'Gravier' },
        montagnes: { force: 0.6, taille: 1000, hauteur: 45 },
        ecartPoles: 45, humidite: 0.5,
        strates: ['Pierre', 'Ardoise', 'Pierre', 'Diorite'],
        minerais: [{ bloc: 'Minerai de fer', frequence: 0.012, profondeurMax: 60 }, { bloc: 'Minerai de platine', frequence: 0.004, profondeurMax: 30 }],
        biomes: [
          { nom: 'Forêt de bouleaux', couleur: '#5a3a8a', conditions: { temperature: [2, 24], humidite: [0.5, 1] },
            dessus: 'Mousse violette', dessous: 'Terre',
            arbres: { densite: 0.55, tronc: 'Bûche de bouleau', feuilles: 'Feuilles de bouleau', hauteur: [5, 8], couronne: 2, espacement: 6 },
            plantes: [{ bloc: 'Champignon lumineux', densite: 0.01 }] },
          { nom: 'Prairie de mousse', couleur: '#7a5aa8', conditions: { temperature: [2, 26], humidite: [0.2, 0.5] },
            dessus: 'Mousse violette', dessous: 'Terre', plantes: [{ bloc: 'Herbe haute', densite: 0.12 }],
            arbres: { densite: 0.04, tronc: 'Bûche de bouleau', feuilles: 'Feuilles de bouleau', hauteur: [5, 7] } },
          { nom: 'Désert ocre', couleur: '#c87a40', conditions: { temperature: [20, 99], humidite: [0, 0.35] },
            dessus: 'Sable ocre', dessous: 'Grès', dunes: true,
            formations: [{ bloc: 'Grès', tete: 'Roche rouge', densite: 0.08, hauteur: [3, 8], largeur: 1.4 }] },
          { nom: 'Toundra', couleur: '#b8b0c8', conditions: { temperature: [-8, 2] },
            dessus: 'Sol à lichens violet-noir', dessous: 'Terre' },
          { nom: 'Glacier', couleur: '#e8f0ff', conditions: { temperature: [-99, -8] }, dessus: 'Neige', dessous: 'Glace' },
          { nom: 'Sommets', couleur: '#f4f4f8', conditions: { altitude: [34, 999] }, dessus: 'Neige', dessous: 'Pierre' },
        ],
      },
    },
    {
      id: 'velia-i', nom: 'Vélia I', autour: 'velia', distance: 28, taille: 0.25,
      description: 'La petite lune grise de Vélia.',
      terrain: { style: 'moon', base: 60, relief: 14, dessus: 'Régolithe', dessous: 'Régolithe', roche: 'Roche lunaire', profond: 'Basalte' },
    },
    {
      id: 'morvane', nom: 'Morvane', type: 'geante-gazeuse', autour: 'centre', distance: 4.5, taille: 9, jour: 0.5,
      description: 'Géante aux bandes vertes et turquoise, et ses anneaux sombres.',
      bandes: ['#2a8a6a', '#5ac8a0', '#1a6a5a', '#8ae0c0', '#3aa080'], tache: '#e0ff60',
      anneaux: [{ de: 1.4, a: 1.8, opacite: 0.5 }, { de: 1.9, a: 2.2, opacite: 0.3 }], couleurAnneaux: '#6a5a8a',
    },
  ],
};
