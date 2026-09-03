export interface Review {
  id: string;
  name: string;
  initials: string;
  rating: number;
  date: string;
  location: string;
  text: string;
  avatarGradient: string;
  verified?: boolean;
}

export const REVIEWS: Review[] = [
  {
    id: "r1",
    name: "Marcus El-Cordova",
    initials: "ME",
    rating: 5,
    date: "2 weeks ago",
    location: "SoHo Flagship, NY",
    text: "The Classic Smash was a religious experience. That caramelized onion jam with the double smash — my mouth is watering just remembering it. Blaze sauce needs to be sold by the gallon.",
    avatarGradient: "linear-gradient(135deg,#E8542A,#F2B33D)",
    verified: true,
  },
  {
    id: "r2",
    name: "Jasmine Whitmore",
    initials: "JW",
    rating: 5,
    date: "1 month ago",
    location: "LA Arts District",
    text: "I've had Nashville hot all over the country and NOTHING touches these tenders. The crunch is insane and the heat hits perfectly without drowning the flavor. 10/10.",
    avatarGradient: "linear-gradient(135deg,#7B2D8B,#E8542A)",
    verified: true,
  },
  {
    id: "r3",
    name: "Diego Santos",
    initials: "DS",
    rating: 4,
    date: "3 weeks ago",
    location: "Brooklyn, NY",
    text: "Genuinely the most loaded fries I've ever seen. Peri-peri dust + liquid cheddar + bacon = perfection on a plate. Only wish I lived closer for delivery.",
    avatarGradient: "linear-gradient(135deg,#1C120C,#F2B33D)",
    verified: true,
  },
  {
    id: "r4",
    name: "Aisha Okafor",
    initials: "AO",
    rating: 5,
    date: "1 week ago",
    location: "London, Shoreditch",
    text: "The Oreo Obsession shake is dangerously good. Took one sip and made my whole table spend £50. The Zinger Crunch Wrap became an instant addiction.",
    avatarGradient: "linear-gradient(135deg,#3D5A80,#98C1D9)",
    verified: true,
  },
  {
    id: "r5",
    name: "Tom Berkowitz",
    initials: "TB",
    rating: 5,
    date: "2 days ago",
    location: "SoHo Flagship, NY",
    text: "Ordered the Family Feast for a game night. Arrived hot, everything glistening, portions enormous. The lava cake had us fighting over the last spoon. New tradition.",
    avatarGradient: "linear-gradient(135deg,#2A9D8F,#E9C46A)",
    verified: false,
  },
  {
    id: "r6",
    name: "Priya Raghavan",
    initials: "PR",
    rating: 5,
    date: "5 days ago",
    location: "LA Arts District",
    text: "As a veggie I usually feel left out at burger joints. The Veggie Delight with truffle aioli genuinely blew me away. Finally a spot where plant eaters feast too.",
    avatarGradient: "linear-gradient(135deg,#E76F51,#F4A261)",
    verified: true,
  },
];
