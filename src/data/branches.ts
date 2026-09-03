export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface ScheduleBlock {
  open: number;
  close: number;
}

export type BranchSchedule = Record<Weekday, ScheduleBlock[]>;

export interface Branch {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  hours: string;
  coordinates: { lat: number; lng: number };
  isFeatured?: boolean;
  parking?: string;
  deliveryRadius?: string;
}

const byDay = (schedule: Partial<Record<Weekday, ScheduleBlock[]>>): BranchSchedule => ({
  mon: [],
  tue: [],
  wed: [],
  thu: [],
  fri: [],
  sat: [],
  sun: [],
  ...schedule,
});

export const BRANCH_SCHEDULES: Record<string, BranchSchedule> = {
  "nyc-soho": byDay({
    sun: [{ open: 660, close: 1380 }],
    mon: [{ open: 660, close: 1380 }],
    tue: [{ open: 660, close: 1380 }],
    wed: [{ open: 660, close: 1380 }],
    thu: [{ open: 660, close: 1380 }],
    fri: [{ open: 660, close: 1440 }, { open: 0, close: 60 }],
    sat: [{ open: 660, close: 1440 }, { open: 0, close: 60 }],
  }),
  "nyc-brooklyn": byDay({
    sun: [{ open: 660, close: 1440 }],
    sat: [{ open: 660, close: 1440 }],
    fri: [{ open: 660, close: 1440 }],
    mon: [{ open: 660, close: 1440 }],
    tue: [{ open: 660, close: 1440 }],
    wed: [{ open: 660, close: 1440 }],
    thu: [{ open: 660, close: 1440 }],
  }),
  "la-arts-district": byDay({
    sun: [{ open: 660, close: 1320 }],
    mon: [{ open: 660, close: 1320 }],
    tue: [{ open: 660, close: 1320 }],
    wed: [{ open: 660, close: 1320 }],
    thu: [{ open: 660, close: 1320 }],
    fri: [{ open: 660, close: 1440 }],
    sat: [{ open: 660, close: 1440 }],
  }),
  "london-shoreditch": byDay({
    sun: [{ open: 720, close: 1200 }],
    mon: [{ open: 720, close: 1320 }],
    tue: [{ open: 720, close: 1320 }],
    wed: [{ open: 720, close: 1320 }],
    thu: [{ open: 720, close: 1320 }],
    fri: [{ open: 720, close: 1320 }],
    sat: [{ open: 720, close: 1320 }],
  }),
};

export const BRANCHES: Branch[] = [
  {
    id: "nyc-soho",
    name: "SoHo Flagship",
    address: "123 Prince Street",
    city: "New York, NY",
    phone: "+1 (212) 555-0199",
    hours: "Sun–Thu 11am–11pm · Fri–Sat 11am–1am",
    coordinates: { lat: 40.7233, lng: -74.003 },
    isFeatured: true,
    parking: "Paid street + garage",
    deliveryRadius: "Covers all of Manhattan",
  },
  {
    id: "nyc-brooklyn",
    name: "Brooklyn Williamsburg",
    address: "45 Bedford Avenue",
    city: "Brooklyn, NY",
    phone: "+1 (718) 555-0143",
    hours: "Every day 11am–12am",
    coordinates: { lat: 40.7197, lng: -73.9575 },
    deliveryRadius: "Williamsburg, Greenpoint, Bushwick",
  },
  {
    id: "la-arts-district",
    name: "LA Arts District",
    address: "888 Mateo Street",
    city: "Los Angeles, CA",
    phone: "+1 (323) 555-0147",
    hours: "Sun–Thu 11am–10pm · Fri–Sat 11am–12am",
    coordinates: { lat: 34.0377, lng: -118.235 },
    parking: "Free dedicated lot",
    isFeatured: true,
    deliveryRadius: "Downtown LA, Silver Lake, Echo Park",
  },
  {
    id: "london-shoreditch",
    name: "Shoreditch",
    address: "45 Redchurch Street",
    city: "London, UK",
    phone: "+44 20 7555 0123",
    hours: "Mon–Sat 12pm–10pm · Sun 12pm–8pm",
    coordinates: { lat: 51.5255, lng: -0.0743 },
    deliveryRadius: "Shoreditch, Hoxton, Spitalfields",
  },
];