/* Automatic allergen detection from ingredient names (English and Bulgarian).
   The 14 allergens are the EU list. A word matches at the start of a word, so "egg" finds
   "eggs" and "egg yolk" but not "veggie". A trailing "!" means the whole word only
   ("cod!" finds "cod" but not "coda"). */
(function () {
  'use strict';
  const K = window.K;
  K.ALLERGENS = [['gluten', 'Gluten'], ['crustaceans', 'Crustaceans'], ['eggs', 'Eggs'], ['fish', 'Fish'], ['peanuts', 'Peanuts'], ['soy', 'Soy'], ['milk', 'Milk'], ['nuts', 'Tree nuts'], ['celery', 'Celery'], ['mustard', 'Mustard'], ['sesame', 'Sesame'], ['sulphites', 'Sulphites'], ['lupin', 'Lupin'], ['molluscs', 'Molluscs']];
  K.AL = {};
  K.ALLERGENS.forEach((a) => { K.AL[a[0]] = a[1]; });

  const WORDS = {
  gluten:['wheat','flour','bread','breadcrumb','panko','brioche','pasta','spaghetti','tagliatelle','linguine','noodle','udon','ramen','semolina','durum','barley','rye!','spelt','malt','couscous','bulgur','farro','seitan','croissant','puff pastry','filo','phyllo','pastry','biscuit','cracker','crouton','tortilla','pita','sourdough','beer','soy sauce','teriyaki','hoisin','брашно','лимец','einkorn','пшени','хляб','галет','ечемик','ръж','спелта','грис','булгур','кус-кус','кускус','спагети','бира','бутер','кроасан','бисквит','соев сос','юфка','панко','кикоман','kikkoman'],
  crustaceans:['shrimp','prawn','crab','lobster','langoustine','crayfish','scampi','krill','скарид','рак!','раци!','омар','лангуст','лангустин'],
  eggs:['egg','yolk','albumen','mayonnaise','mayo!','aioli','meringue','hollandaise','béarnaise','bearnaise','custard','яйц','яйчн','жълтък','жълтъц','белтък','белтъц','майонез','айоли','меринг'],
  fish:['fish','salmon','tuna','cod!','sea bass','seabass','bass!','trout','anchov','sardin','mackerel','halibut','turbot','bream','hake','pike!','carp!','sole!','plaice','monkfish','snapper','mullet','bonito','katsuobushi','dashi','caviar','roe!','ikura','tobiko','katsuobushi','кацубуши','гарум','worcestershire','colatura','garum','риба','рибен','рибн','сьомга','пъстърв','лаврак','ципура','аншоа','сардин','скумри','тон!','риба тон','треска','калкан','шаран','щука','хайвер','хек','барбун','паламуд','чернокоп'],
  peanuts:['peanut','groundnut','satay','фъстък','фъстъц'],
  soy:['soy','soya','tofu','edamame','miso','tamari','tempeh','natto','teriyaki','hoisin','соя','соев','тофу','мисо','понзу','ponzu','кикоман','kikkoman'],
  milk:['milk','cream','butter','ghee','cheese','parmesan','parmigiano','pecorino','grana','mascarpone','ricotta','mozzarella','burrata','stracciatella','feta','gorgonzola','brie','camembert','cheddar','comté','comte','gruyère','gruyere','emmental','halloumi','labneh','yogurt','yoghurt','kefir','crème','creme','fraiche','fraîche','whey','casein','lactose','buttermilk','quark','skyr','béchamel','bechamel','ice cream','gelato','мляко','млечн','сметан','сирене','кашкавал','краве масло','масло','извара','йогурт','кефир','пармезан','моцарела','рикота','маскарпоне','суроватка','каймак','бешамел','сладолед','сирен','катък','катик','katyk','крокмач','геран','тейзе','дулсе де лече','dulce de leche','бял шоколад','white chocolate'],
  nuts:['almond','hazelnut','walnut','cashew','pecan','pistachio','macadamia','brazil nut','pine nut','praline','marzipan','frangipane','gianduja','nutella','orgeat','бадем','лешни','орех','орехи','кашу','пекан','шам фъстък','шамфъстък','макадами','пралин','марципан'],
  celery:['celery','celeriac','целин'],
  mustard:['mustard','dijon','дижон','горчиц'],
  sesame:['sesame','tahini','tahina','gomasio','furikake','togarashi','тогараши','сусам','тахан','тахини'],
  sulphites:['wine','vinegar','port!','sherry','madeira','marsala','vermouth','mirin','sake!','cider','balsamic','verjus','sulphite','sulfite','dried apricot','вино','винен','оцет','балсам','шери','портвайн','мадейра','сулфит'],
  lupin:['lupin','lupine','лупин'],
  molluscs:['mussel','oyster','clam','scallop','squid','octopus','cuttlefish','calamari','snail','escargot','whelk','cockle','abalone','миди','мида','стрид','калмар','октопод','сепия','охлюв','морски дар']
};
  /* phrases removed before matching: they contain an allergen word but are not that allergen */
  const NOT = ['шам фъстък','шамфъстък','сирене кашу','алтернативно мляко','eggplant','coconut milk','coconut cream','oat milk','rice milk','almond milk','soy milk','soya milk','cocoa butter','shea butter','butternut','butter bean','butterhead','nutmeg','cream of tartar','buckwheat','rice flour','corn flour','cornflour','maize flour','potato flour','potato starch','tapioca flour','chickpea flour','gram flour','gluten-free','gluten free','maltodextrin','rice noodle','glass noodle','rice paper','ракия','plant-based','vegan','sweet potato','water chestnut','pepper','peppercorn','fish-free','kokosovo','кокосово мляко','овесено мляко','бадемово мляко','оризово мляко','оризово брашно','царевично брашно','нишесте','зехтин','олио','растително масло','слънчогледово масло','маслинено масло','кокосово масло','какаово масло','сусамово масло','масло от','тиквено масло','елда','индийско орехче','индийско орехово','джинджифилова бира','ginger beer','кисело мляко кашу','масло от рапица','олио'];
  /* phrases that imply a second allergen (soy sauce has wheat, pesto has nuts and cheese) */
  const ALSO = {'шам фъстък':['nuts'],'шамфъстък':['nuts'],'сирене кашу':['nuts'],'soy sauce':['gluten'],'соев сос':['gluten'],'pesto':['nuts','milk'],'песто':['nuts','milk'],'almond milk':['nuts'],'бадемово мляко':['nuts'],'almond flour':['nuts'],'peanut butter':['peanuts'],'soy milk':['soy'],'mayonnaise':['eggs','mustard'],'холандез':['eggs','milk'],'бешамел':['gluten','milk'],'мляко кашу':['nuts'],'aioli':['eggs'],'caesar':['eggs','fish','milk'],'worcestershire':['fish'],'hollandaise':['eggs','milk'],'béarnaise':['eggs','milk'],'bearnaise':['eggs','milk'],'praline':['nuts'],'nougat':['nuts','eggs'],'brioche':['eggs','milk'],'croissant':['milk'],'custard':['eggs','milk'],'ice cream':['milk','eggs']};
  /* sauces whose name contains an allergen word but whose recipe is separate */
  const SKIP = ['редукция холандез', 'hollandaise reduction'];

  const L = 'a-zà-ÿа-яё';
  const esc = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const RE = {};
  Object.keys(WORDS).forEach((k) => {
    const alts = WORDS[k].map((w) => (w.endsWith('!') ? esc(w.slice(0, -1)) + '(?![' + L + '])' : esc(w)));
    RE[k] = new RegExp('(^|[^' + L + '])(' + alts.join('|') + ')', 'i');
  });

  K.allergensIn = function (name) {
    let t = ' ' + String(name || '').toLowerCase() + ' ';
    const hits = {};
    SKIP.forEach((p) => { t = t.split(p).join(' '); });
    Object.keys(ALSO).forEach((p) => { if (t.includes(p)) ALSO[p].forEach((k) => { hits[k] = 1; }); });
    NOT.forEach((p) => { t = t.split(p).join(' '); });
    Object.keys(RE).forEach((k) => { if (RE[k].test(t)) hits[k] = 1; });
    return Object.keys(hits);
  };
  /* ingredient lists -> {allergenKey: [ingredient names]}; g.o is the original-language name */
  K.detectAllergens = function (lists) {
    const found = {};
    lists.forEach((l) => (l || []).forEach((g) => {
      const n = ((g && g.n) || '').trim();
      if (!n) return;
      K.allergensIn(g.o || n).forEach((k) => { (found[k] = found[k] || []); if (!found[k].includes(n)) found[k].push(n); });
    }));
    return found;
  };
  K.orderAl = (keys) => K.ALLERGENS.map((a) => a[0]).filter((k) => keys.includes(k));
})();
