// Les véhicules de la collection HexaTrains (voir trainmodels.js) : locomotives, tenders, voitures
// et wagons, chacun avec son objet. Pas de three.js ici : blocks.js en fait des objets.
//  - model : le nom du modèle (trainmodels.js, BUILDERS) ;
//  - kind : ce que fait la voiture dans le train (voir trains.js : loco, tender, passenger,
//    covered (un coffre), hopper, armored (tourelles)) ;
//  - eng : le moteur d'une locomotive (vitesse, accélération, consommation, énergie ; heavy :
//    un train lourd la ralentit moins), whistle : son sifflet ('war' : grave).
const HX_FIRST = 670;
const L = (model, name, eng, whistle = 'clear') => ({ model, name, kind: 'loco', eng, whistle });
const V = (vmax, acc, burn, power = 'steam', heavy) => ({ vmax, acc, burn, power, ...(heavy ? { heavy } : {}) });
const C = (kind) => (model, name) => ({ model, name, kind });
const tender = C('tender'), coach = C('passenger'), box = C('covered'), gun = C('armored');
export const HX_LIST = [
  // locomotives
  L('carenee', 'Pacific carénée', V(38, 0.9, 1.3)),
  L('p231', 'Pacific 231 G', V(34, 1.05, 1.2)),
  L('a3', 'Pacific A3', V(36, 1, 1.25)),
  L('a1', 'Pacific A1', V(33, 1, 1.2)),
  L('v2', 'Locomotive V2', V(30, 1.15, 1.15)),
  L('loco19', 'Locomotive 120', V(24, 0.85, 0.9)),
  L('american', 'Locomotive 220 américaine', V(22, 0.9, 0.85)),
  L('t030', 'Locomotive-tender 030 T', V(18, 1.2, 0.8, 'steam', 0.85), 'war'),
  L('petite', 'Petite locomotive 030', V(20, 1.05, 0.8)),
  L('locotracteur', 'Locotracteur diesel', V(16, 1.5, 0.7, 'fuel', 0.6)),
  L('blindee', 'Locomotive blindée', V(25, 1.3, 1.1, 'steam', 0.75), 'war'),
  L('panzerlok', 'Locomotive blindée camouflée', V(26, 1.35, 1.05, 'steam', 0.75), 'war'),
  L('draisine', 'Draisine blindée', V(24, 1.3, 0.8, 'fuel', 0.8)),
  L('chibi', 'Petite locomotive de conte', V(16, 1.1, 0.6)),
  // tenders
  tender('tender', 'Tender de la Pacific carénée'),
  tender('tender231', 'Tender de la 231 G'),
  tender('tenderCouloir', 'Tender à couloir'),
  tender('tenderV2', 'Tender à trois essieux'),
  tender('tender19', 'Tender de la 120'),
  tender('tenderUS', 'Tender américain'),
  tender('tenderPetit', 'Petit tender'),
  tender('tenderBlinde', 'Tender blindé'),
  tender('tenderPanzer', 'Tender camouflé'),
  // voitures (des places assises) et fourgons (un coffre)
  coach('voiture', 'Voiture voyageurs 2e classe'),
  coach('voitureVerte', 'Voiture verte à toit gris'),
  coach('lits', 'Voiture-lits'),
  coach('restaurant', 'Voiture-restaurant'),
  box('fourgonLuxe', 'Fourgon à bagages'),
  coach('voitureY', 'Voiture vert et crème'),
  coach('voitureEilzug', 'Voiture à salle'),
  coach('voitureDzug', 'Voiture à compartiments'),
  box('fourgonDzug', 'Fourgon à bagages vert'),
  box('fourgonVert', 'Petit fourgon vert'),
  coach('voitureConte', 'Voiture de conte'),
  // wagons
  box('couvert', 'Wagon couvert en planches'),
  box('couvertSable', 'Wagon couvert camouflé'),
  box('betail', 'Wagon à bestiaux'),
  box('citerne', 'Wagon-citerne'),
  box('conteneur', 'Wagon porte-conteneur'),
  coach('fourgon', 'Fourgon de queue à vigie'),
  box('fourgonSable', 'Fourgon de troupe'),
  box('fusee', 'Wagon porte-fusée'),
  box('bache', 'Wagon bâché'),
  gun('wagonCanon', 'Wagon canon blindé'),
  gun('wagonDCA', 'Wagon DCA'),
  { model: 'tremie', name: 'Wagon-trémie céréalier', kind: 'hopper' },
  box('guerite', 'Wagon couvert à guérite'),
  box('couvertGs', 'Wagon couvert rouge'),
  box('ranchers', 'Wagon à ranchers chargé de tubes'),
  coach('infanterie', "Wagon d'infanterie blindé"),
  gun('tombereauFlak', 'Tombereau à canon antiaérien'),
  gun('tombereauChar', "Tombereau chargé d'un char"),
  box('platAvion', "Wagon chargé d'un avion"),
  gun('wagonTourelles', 'Wagon blindé à deux tourelles'),
  gun('flakBois', 'Wagon DCA en bois'),
];
HX_LIST.forEach((v, i) => { v.item = HX_FIRST + i; });
export const HX = Object.fromEntries(HX_LIST.map((v) => [v.model, v]));
// fichier de l'icône (texture/objets/train/hx_<modèle>_hex.png)
export const hxIcon = (model) => 'texture/objets/train/hx_' + model.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase()) + '_hex.png';
