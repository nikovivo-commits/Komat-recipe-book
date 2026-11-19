/* Starting recipes for a new kitchen: a small demo set. A kitchen's own recipes live in its database.
   (Komat's recipes are not in this public file.) */
window.KOMAT_SEED = window.KOMAT_SEED || {};
window.KOMAT_SEED.recipes = [
 {
  "allergensChecked": true,
  "notes": "",
  "onMenu": true,
  "photo": "",
  "plating": "",
  "videos": [],
  "updated": 1794700800000,
  "id": "demo-eggs-benedict",
  "name": "Eggs Benedict",
  "category": "Breakfast & brunch",
  "type": "dish",
  "station": "hot",
  "services": [
   "breakfast",
   "brunch"
  ],
  "allergens": [
   "eggs",
   "milk",
   "gluten"
  ],
  "yieldQty": "1",
  "yieldUnit": "portions",
  "ingredients": [
   {
    "n": "Hollandaise",
    "q": "60",
    "u": "g"
   },
   {
    "n": "Poached eggs",
    "q": "2",
    "u": "pcs"
   },
   {
    "n": "English muffin, toasted",
    "q": "1",
    "u": "pcs"
   },
   {
    "n": "Smoked ham",
    "q": "40",
    "u": "g"
   },
   {
    "n": "Chives, chopped",
    "q": "",
    "u": ""
   }
  ],
  "components": [
   {
    "cid": "cdemohol01",
    "name": "Hollandaise",
    "station": "hot",
    "ingredients": [
     {
      "n": "egg yolks",
      "q": "4",
      "u": "pcs"
     },
     {
      "n": "butter, clarified",
      "q": "250",
      "u": "g"
     },
     {
      "n": "lemon juice",
      "q": "15",
      "u": "ml"
     },
     {
      "n": "water",
      "q": "20",
      "u": "ml"
     },
     {
      "n": "salt",
      "q": "",
      "u": ""
     }
    ],
    "steps": [
     "Whisk the yolks with the water over a bain-marie until thick and pale (about 65 °C).",
     "Take off the heat and whisk in the warm butter in a thin stream.",
     "Season with lemon juice and salt. Keep warm, not hot, and use within 2 hours."
    ],
    "notes": "",
    "yieldQty": "400",
    "yieldUnit": "g"
   },
   {
    "cid": "cdemopoa01",
    "name": "Poached eggs",
    "station": "hot",
    "ingredients": [
     {
      "n": "eggs, fresh",
      "q": "10",
      "u": "pcs"
     },
     {
      "n": "white vinegar",
      "q": "30",
      "u": "ml"
     }
    ],
    "steps": [
     "Bring water with the vinegar to a bare simmer.",
     "Crack each egg into a cup, stir the water and slide the egg in. Cook 3 minutes.",
     "Lift out, cool in iced water if holding, reheat 30 seconds before service."
    ],
    "notes": "",
    "yieldQty": "10",
    "yieldUnit": "pcs"
   }
  ],
  "steps": [
   "Toast the muffin and warm the ham.",
   "Top each half with ham and a poached egg.",
   "Spoon over the hollandaise and finish with chives."
  ]
 },
 {
  "allergensChecked": true,
  "notes": "",
  "onMenu": true,
  "photo": "",
  "plating": "",
  "videos": [],
  "updated": 1794700800000,
  "id": "demo-chicken-stock",
  "name": "Chicken stock",
  "category": "Sauces & stocks",
  "type": "recipe",
  "station": "hot",
  "services": [],
  "allergens": [
   "celery"
  ],
  "yieldQty": "5",
  "yieldUnit": "l",
  "components": [],
  "ingredients": [
   {
    "n": "chicken bones",
    "q": "3",
    "u": "kg"
   },
   {
    "n": "onion",
    "q": "2",
    "u": "pcs"
   },
   {
    "n": "carrot",
    "q": "2",
    "u": "pcs"
   },
   {
    "n": "celery",
    "q": "2",
    "u": "stalks"
   },
   {
    "n": "bay leaf",
    "q": "2",
    "u": "pcs"
   },
   {
    "n": "black peppercorns",
    "q": "5",
    "u": "g"
   },
   {
    "n": "cold water",
    "q": "7",
    "u": "l"
   }
  ],
  "steps": [
   "Rinse the bones, cover with cold water and bring slowly to a simmer.",
   "Skim, add the vegetables and aromatics, simmer gently for 4 hours.",
   "Strain, cool quickly in an ice bath, label and date. Keeps 3 days chilled."
  ]
 },
 {
  "allergensChecked": true,
  "notes": "",
  "onMenu": true,
  "photo": "",
  "plating": "",
  "videos": [],
  "updated": 1794700800000,
  "id": "demo-pickled-shallots",
  "name": "Pickled shallots",
  "category": "Starters",
  "type": "recipe",
  "station": "cold",
  "services": [],
  "allergens": [
   "sulphites"
  ],
  "yieldQty": "500",
  "yieldUnit": "g",
  "components": [],
  "ingredients": [
   {
    "n": "shallots, sliced into rings",
    "q": "400",
    "u": "g"
   },
   {
    "n": "white wine vinegar",
    "q": "200",
    "u": "ml"
   },
   {
    "n": "water",
    "q": "200",
    "u": "ml"
   },
   {
    "n": "sugar",
    "q": "80",
    "u": "g"
   },
   {
    "n": "salt",
    "q": "8",
    "u": "g"
   }
  ],
  "steps": [
   "Bring vinegar, water, sugar and salt to the boil.",
   "Pour over the shallots and leave to cool.",
   "Keep covered in the fridge; ready after 2 hours, best within a week."
  ]
 },
 {
  "allergensChecked": true,
  "notes": "",
  "onMenu": true,
  "photo": "",
  "plating": "",
  "videos": [],
  "updated": 1794700800000,
  "id": "demo-creme-brulee",
  "name": "Crème brûlée",
  "category": "Desserts",
  "type": "dish",
  "station": "cold",
  "services": [
   "alacarte"
  ],
  "allergens": [
   "eggs",
   "milk"
  ],
  "yieldQty": "8",
  "yieldUnit": "portions",
  "components": [],
  "ingredients": [
   {
    "n": "cream 35%",
    "q": "750",
    "u": "ml"
   },
   {
    "n": "vanilla pod",
    "q": "1",
    "u": "pcs"
   },
   {
    "n": "egg yolks",
    "q": "8",
    "u": "pcs"
   },
   {
    "n": "sugar",
    "q": "120",
    "u": "g"
   },
   {
    "n": "demerara sugar, to glaze",
    "q": "80",
    "u": "g"
   }
  ],
  "steps": [
   "Warm the cream with the split vanilla pod.",
   "Whisk yolks and sugar, pour over the warm cream, strain.",
   "Fill ramekins and bake in a water bath at 100 °C for 40 minutes until just set.",
   "Chill, then sprinkle with demerara and caramelise with a torch before serving."
  ]
 }
];
