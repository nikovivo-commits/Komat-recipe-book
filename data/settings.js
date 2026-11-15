/* Starting kitchen settings for a new kitchen: demo station lists and rota codes. */
window.KOMAT_SEED = window.KOMAT_SEED || {};
window.KOMAT_SEED.settings = {
 "checklists": {
  "stations": {
   "cold": {
    "sections": [
     {
      "key": "sc1",
      "name": "Mise en place",
      "groups": [
       {
        "key": "gc1",
        "name": "Salads",
        "items": [
         {
          "id": "gc1i0",
          "name": "washed leaves"
         },
         {
          "id": "gc1i1",
          "name": "vinaigrette"
         },
         {
          "id": "gc1i2",
          "name": "pickled shallots",
          "link": "demo-pickled-shallots"
         }
        ]
       },
       {
        "key": "gc2",
        "name": "Desserts",
        "items": [
         {
          "id": "gc2i0",
          "name": "crème brûlée",
          "link": "demo-creme-brulee"
         },
         {
          "id": "gc2i1",
          "name": "demerara sugar"
         }
        ]
       }
      ]
     }
    ]
   },
   "hot": {
    "sections": [
     {
      "key": "sh1",
      "name": "Mise en place",
      "groups": [
       {
        "key": "gh1",
        "name": "Brunch",
        "items": [
         {
          "id": "gh1i0",
          "name": "hollandaise",
          "link": "demo-eggs-benedict"
         },
         {
          "id": "gh1i1",
          "name": "poached eggs"
         },
         {
          "id": "gh1i2",
          "name": "muffins"
         }
        ]
       },
       {
        "key": "gh2",
        "name": "Stocks",
        "items": [
         {
          "id": "gh2i0",
          "name": "chicken stock",
          "link": "demo-chicken-stock"
         }
        ]
       }
      ]
     }
    ]
   },
   "pass": {
    "sections": [
     {
      "key": "sp1",
      "name": "Pass",
      "groups": [
       {
        "key": "gp1",
        "name": "Before service",
        "items": [
         {
          "id": "gp1i0",
          "name": "plates warm"
         },
         {
          "id": "gp1i1",
          "name": "garnish tray"
         },
         {
          "id": "gp1i2",
          "name": "tickets and pens"
         }
        ]
       }
      ]
     }
    ]
   }
  }
 },
 "kitchen": {
  "orderContact": "",
  "orderDue": "23:00"
 },
 "shiftcodes": {
  "codes": [
   {
    "code": "P",
    "label": "Works (11:00–23:00)"
   },
   {
    "code": "1",
    "label": "First shift"
   },
   {
    "code": "2",
    "label": "Second shift"
   },
   {
    "code": "BR",
    "label": "Breakfast (until 16:00)"
   },
   {
    "code": "X",
    "label": "Day off"
   },
   {
    "code": "0",
    "label": "Day off"
   },
   {
    "code": "DO 21",
    "label": "Until 21:00"
   },
   {
    "code": "SER",
    "label": ""
   }
  ]
 }
};
