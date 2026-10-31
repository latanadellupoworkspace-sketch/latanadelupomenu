// Modifiche al menu preparate da Ivan.
// Ogni blocco viene applicato UNA sola volta, in automatico, al primo accesso all'area admin
// (l'id viene salvato in settings/general.appliedUpdates). Un prodotto già presente non viene duplicato.
export const UPDATES = [
  {
    id: "2026-10-31-hotdog-crauti-souffle-fiordilatte",
    add: [
      {
        id: "american-hot-dog-03",
        data: {
          name: "AMERICAN HOT DOG CON CRAUTI E MOSTARDA",
          description: "Panino, würstel di suino, crauti e mostarda, servito con porzione di patatine",
          price: 6,
          categoryId: "american-hot-dog",
          order: 2,
          available: true,
          visible: true,
          image: "",
          tags: [],
          allergens: ["glutine", "senape"]   // pane e mostarda: allergeni certi
        }
      },
      {
        id: "dolci-07",
        data: {
          name: "Soufflé al cioccolato dal cuore morbido con cascata di gelato al fior di latte",
          description: "Tortino al cioccolato dal cuore morbido, servito con una cascata di gelato al fior di latte",
          price: 6,
          categoryId: "dolci",
          order: 6,
          available: true,
          visible: true,
          image: "",
          tags: [],
          allergens: ["latte"]   // gelato al fior di latte
        }
      }
    ]
  }
];
