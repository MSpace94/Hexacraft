// Le système Akhena : fait dans l'atelier des systèmes (lancer-atelier.bat).
// Tu peux aussi le changer à la main : tous les paramètres sont expliqués dans _modele.js.
export default {
  id: 'akhena',
  nom: 'Akhena',
  actif: true,
  description: '',
  position: {
    distance: 31.9,
    direction: 28,
    hauteur: 53,
  },
  etoiles: [
    {
      nom: 'Chamallow',
      type: 'naine-jaune',
      id: 'etoile-akhena',
      couleur: '#e12375',
      couronne: '#b33750',
      lumiereAuSol: 0.45,
      temperature: 4850000,
      inclinaison: 69,
      description: 'une étoile qui est là ? Pourquoi ? On s\'en fou',
    },
    {
      id: 'akhena-etoile',
      nom: 'Batiste-Trou',
      type: 'trou-noir',
      orbite: { autour: 'etoile-akhena', distance: 5, barycentre: true },
      taille: 25,
    },
  ],
  planetes: [
    {
      id: 'autiste-batiste',
      nom: 'autiste-batiste',
      type: 'lune',
      autour: 'centre',
      atmosphere: { respirable: true, ciel: '#4a8ad8', densite: 0.54 },
      terrain: {
        style: 'biomes',
        base: 62,
        relief: 24,
        mer: { niveau: 56, liquide: 'eau', plage: 'Sable', fond: 'Sable' },
        biomes: [
          {
            nom: 'Prairie',
            couleur: '#4a8a3a',
            dessus: 'Herbe',
            dessous: 'Terre',
            plantes: [{ bloc: 'Herbe haute', densite: 0.1 }],
          },
          {
            nom: 'Forêt',
            couleur: '#2e6a2a',
            conditions: { humidite: [0.55, 1] },
            dessus: 'Herbe',
            dessous: 'Terre',
            arbres: {
              densite: 0.5,
              tronc: 'Bûche de chêne',
              feuilles: 'Feuilles de chêne',
              hauteur: [4, 7],
              couronne: 2,
              espacement: 5,
            },
          },
          {
            nom: 'Sommets',
            couleur: '#f0f4f8',
            conditions: { altitude: [35, 999] },
            dessus: 'Neige',
            dessous: 'Pierre',
          },
        ],
      },
      periode: 846,
      excentricite: 0.36,
      distance: 18.54,
      taille: 0.15,
    },
  ],
};
