export type WorkspaceType =
  | "Collector"
  | "Seller"
  | "LGS"
  | "Warehouse";

export type Workspace = {
  id: string;
  name: string;
  type: WorkspaceType;
  initials: string;
};

export const workspaces: Workspace[] = [
  {
    id: "business",
    name: "Trading Docks LLC",
    type: "Seller",
    initials: "TD",
  },
  {
    id: "personal",
    name: "Personal Collection",
    type: "Collector",
    initials: "PC",
  },
  {
    id: "store",
    name: "Phoenix Store",
    type: "LGS",
    initials: "PS",
  },
  {
    id: "warehouse",
    name: "Warehouse West",
    type: "Warehouse",
    initials: "WW",
  },
];