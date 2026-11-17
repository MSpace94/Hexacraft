// Les systèmes stellaires ajoutés à l'univers du jeu : un fichier par système dans ce dossier.
// Cette liste est tenue à jour par l'atelier (lancer-atelier.bat) : crée et modifie tes systèmes là-bas.
// À la main : copie _modele.js, puis ajoute-le ci-dessous (import + dans la liste SYSTEMES).
//
// actif: false dans un système : il n'apparaît que dans l'atelier (un brouillon), pas dans le jeu.
// Une fois qu'une planète a été visitée dans un monde, ne change plus son id (son nom, si).
import s_nyx from './nyx.js?v=1.1.0-mwk9a96e';
import s_lumino from './lumino.js?v=1.1.0-mwk9a96e';
import s_qoe from './qoe.js?v=1.1.0-mwk9a96e';
import s_akhena from './akhena.js?v=1.1.0-mwk9a96e';
import s_qse from './qse.js?v=1.1.0-mwk9a96e';
import s_keryon from './keryon.js?v=1.1.0-mwk9a96e';
import s_sol from './sol.js?v=1.1.0-mwk9a96e';
import s_systeme_sinumis from './systeme-sinumis.js?v=1.1.0-mwk9a96e';
import s_systeme_behisthio from './systeme-behisthio.js?v=1.1.0-mwk9a96e';
import s_raquo from './raquo.js?v=1.1.0-mwk9a96e';
import s_quiorisu from './quiorisu.js?v=1.1.0-mwk9a96e';
import s_narlae from './narlae.js?v=1.1.0-mwk9a96e';
import s_luquae from './luquae.js?v=1.1.0-mwk9a96e';
import s_bonpar from './bonpar.js?v=1.1.0-mwk9a96e';
import s_dronquu from './dronquu.js?v=1.1.0-mwk9a96e';
import s_pibon from './pibon.js?v=1.1.0-mwk9a96e';
import s_graxepo from './graxepo.js?v=1.1.0-mwk9a96e';
import s_zixedre from './zixedre.js?v=1.1.0-mwk9a96e';
import s_bonvezis from './bonvezis.js?v=1.1.0-mwk9a96e';
import s_quargraequu from './quargraequu.js?v=1.1.0-mwk9a96e';
import s_puziopis from './puziopis.js?v=1.1.0-mwk9a96e';
import s_honae from './honae.js?v=1.1.0-mwk9a96e';
import s_xepio from './xepio.js?v=1.1.0-mwk9a96e';
import s_hioxar from './hioxar.js?v=1.1.0-mwk9a96e';
import s_larquaethon from './larquaethon.js?v=1.1.0-mwk9a96e';
import s_sybabio from './sybabio.js?v=1.1.0-mwk9a96e';
import s_logrysu from './logrysu.js?v=1.1.0-mwk9a96e';
import s_quiparpe from './quiparpe.js?v=1.1.0-mwk9a96e';
import s_nisgrexio from './nisgrexio.js?v=1.1.0-mwk9a96e';
import s_pikis from './pikis.js?v=1.1.0-mwk9a96e';
import s_zarrio from './zarrio.js?v=1.1.0-mwk9a96e';
import s_zisxuthis from './zisxuthis.js?v=1.1.0-mwk9a96e';
import s_rarhidry from './rarhidry.js?v=1.1.0-mwk9a96e';
import s_bisxis from './bisxis.js?v=1.1.0-mwk9a96e';
import s_drigry from './drigry.js?v=1.1.0-mwk9a96e';
import s_hibo from './hibo.js?v=1.1.0-mwk9a96e';
import s_rogro from './rogro.js?v=1.1.0-mwk9a96e';
import s_bongronthon from './bongronthon.js?v=1.1.0-mwk9a96e';
import s_lykio from './lykio.js?v=1.1.0-mwk9a96e';
import s_naenon from './naenon.js?v=1.1.0-mwk9a96e';
import s_suky from './suky.js?v=1.1.0-mwk9a96e';
import s_pyhi from './pyhi.js?v=1.1.0-mwk9a96e';
import s_manoma from './manoma.js?v=1.1.0-mwk9a96e';
import s_harlon from './harlon.js?v=1.1.0-mwk9a96e';
import s_greregris from './greregris.js?v=1.1.0-mwk9a96e';
import s_baexone from './baexone.js?v=1.1.0-mwk9a96e';
import s_mumar from './mumar.js?v=1.1.0-mwk9a96e';
import s_thisdryra from './thisdryra.js?v=1.1.0-mwk9a96e';
import s_quazy from './quazy.js?v=1.1.0-mwk9a96e';
import s_gryvabae from './gryvabae.js?v=1.1.0-mwk9a96e';
import s_xibarpae from './xibarpae.js?v=1.1.0-mwk9a96e';
import s_barxonni from './barxonni.js?v=1.1.0-mwk9a96e';
import s_hakongri from './hakongri.js?v=1.1.0-mwk9a96e';
import s_grixio from './grixio.js?v=1.1.0-mwk9a96e';
import s_sonvonmi from './sonvonmi.js?v=1.1.0-mwk9a96e';
import s_miogronxio from './miogronxio.js?v=1.1.0-mwk9a96e';
import s_sonimae from './sonimae.js?v=1.1.0-mwk9a96e';
import s_vykaeve from './vykaeve.js?v=1.1.0-mwk9a96e';
import s_ryvae from './ryvae.js?v=1.1.0-mwk9a96e';

export const SYSTEMES = [
  s_nyx,
  s_lumino,
  s_qoe,
  s_akhena,
  s_qse,
  s_keryon,
  s_sol,
  s_systeme_sinumis,
  s_systeme_behisthio,
  s_raquo,
  s_quiorisu,
  s_narlae,
  s_luquae,
  s_bonpar,
  s_dronquu,
  s_pibon,
  s_graxepo,
  s_zixedre,
  s_bonvezis,
  s_quargraequu,
  s_puziopis,
  s_honae,
  s_xepio,
  s_hioxar,
  s_larquaethon,
  s_sybabio,
  s_logrysu,
  s_quiparpe,
  s_nisgrexio,
  s_pikis,
  s_zarrio,
  s_zisxuthis,
  s_rarhidry,
  s_bisxis,
  s_drigry,
  s_hibo,
  s_rogro,
  s_bongronthon,
  s_lykio,
  s_naenon,
  s_suky,
  s_pyhi,
  s_manoma,
  s_harlon,
  s_greregris,
  s_baexone,
  s_mumar,
  s_thisdryra,
  s_quazy,
  s_gryvabae,
  s_xibarpae,
  s_barxonni,
  s_hakongri,
  s_grixio,
  s_sonvonmi,
  s_miogronxio,
  s_sonimae,
  s_vykaeve,
  s_ryvae,
];
