export interface MenuItem {
  id: string;
  name: string;
  category: 'burgers' | 'chicken' | 'wraps' | 'sides' | 'salads' | 'combos' | 'beverages' | 'desserts' | 'pizza' | 'dips';
  description: string;
  price: number;
  calories: number;
  /** Real photograph URL. Empty string renders a labeled "add real photo" placeholder card. */
  image: string;
  isSpicy?: boolean;
  spiceLevel?: number; // 0-3
  isVeg?: boolean;
  /** True when the item is sold out for the selected branch. */
  isOutOfStock?: boolean;
  badge?: 'Best Seller' | 'New' | "Chef's Pick" | 'Fire Choice' | 'Popular';
  popular?: boolean;
  customization?: {
    sizes?: { name: string; priceDelta: number }[];
    spiceLevels?: string[];
    bunTypes?: string[];
    addOns?: { name: string; price: number }[];
  };
}

export const MENU_ITEMS: MenuItem[] = [
  // ================= BURGERS =================
  {
    id: 'classic-smash-burger',
    name: 'Classic Smash Burger',
    category: 'burgers',
    description: 'Double smashed Angus beef, grilled onions, American cheddar, dill pickles, signature Blaze sauce on toasted potato brioche.',
    price: 11.99,
    calories: 680,
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1200&q=80',
    spiceLevel: 0,
    isVeg: false,
    badge: 'Best Seller',
    popular: true,
    customization: {
      sizes: [
        { name: 'Single Patty', priceDelta: -2.50 },
        { name: 'Double Patty (Standard)', priceDelta: 0 },
        { name: 'Triple Monster Stack', priceDelta: 3.50 }
      ],
      spiceLevels: ['Mild', 'Medium Blaze', 'Inferno +$0.50'],
      bunTypes: ['Potato Brioche', 'Gluten-Free Bun (+$1.50)', 'Lettuce Wrap (Keto)'],
      addOns: [
        { name: 'Applewood Smoked Bacon', price: 2.00 },
        { name: 'Extra Melted Cheddar', price: 1.50 },
        { name: 'Crispy Fried Shallots', price: 1.00 },
        { name: 'Fried Farm Egg', price: 1.75 },
        { name: 'Truffle Aioli Drizzle', price: 1.50 },
        { name: 'Signature Blaze Sauce', price: 1.50 },
        { name: 'Garlic Mayo Dip', price: 1.25 },
        { name: 'Cheese Dip', price: 2.00 },
        { name: 'Buffalo Ranch Dip', price: 1.75 }
      ]
    }
  },
  {
    id: 'flame-grilled-zinger',
    name: 'Flame-Grilled Zinger Burger',
    category: 'burgers',
    description: 'Fiery marinated whole chicken thigh, pickled jalapeños, shredded iceberg lettuce, smoked cayenne mayo on buttered brioche.',
    price: 12.49,
    calories: 720,
    image: 'https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?auto=format&fit=crop&w=1200&q=80',
    isSpicy: true,
    spiceLevel: 3,
    isVeg: false,
    badge: 'Fire Choice',
    popular: true,
    customization: {
      sizes: [
        { name: 'Standard Fillet', priceDelta: 0 },
        { name: 'Double Fillet Deluxe', priceDelta: 4.00 }
      ],
      spiceLevels: ['Blaze Hot', 'Ghost Pepper Inferno'],
      bunTypes: ['Potato Brioche', 'Sesame Bun', 'Lettuce Wrap'],
      addOns: [
        { name: 'Pepper Jack Cheese', price: 1.50 },
        { name: 'Extra Pickled Jalapeños', price: 0.75 },
        { name: 'Crispy Bacon Strips', price: 2.00 }
      ]
    }
  },
  {
    id: 'double-patty-cheese-blaze',
    name: 'Double Patty Cheese Blaze',
    category: 'burgers',
    description: 'Two thick flame-seared chuck patties, triple molten Monterey Jack & sharp cheddar, caramelized red onion jam, roasted garlic butter.',
    price: 13.99,
    calories: 890,
    image: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=1200&q=80',
    spiceLevel: 1,
    isVeg: false,
    badge: "Chef's Pick",
    popular: true,
    customization: {
      sizes: [
        { name: 'Double Patty', priceDelta: 0 },
        { name: 'Triple Tower', priceDelta: 3.50 }
      ],
      bunTypes: ['Artisan Brioche', 'Pretzel Bun (+$1.00)'],
      addOns: [
        { name: 'Charred Bacon Jam', price: 2.25 },
        { name: 'Double Swiss Melt', price: 1.75 },
        { name: 'Avocado Slices', price: 2.00 }
      ]
    }
  },
  {
    id: 'bbq-bacon-burger',
    name: 'BBQ Bacon Burger',
    category: 'burgers',
    description: 'Thick hickory-smoked bacon, crispy onion rings, aged white cheddar, house bourbon BBQ reduction on toasted milk bun.',
    price: 13.49,
    calories: 840,
    image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1200&q=80',
    spiceLevel: 1,
    isVeg: false,
    badge: 'Popular',
    customization: {
      sizes: [
        { name: 'Regular', priceDelta: 0 },
        { name: 'Heavy Smoked Double', priceDelta: 3.50 }
      ],
      bunTypes: ['Milk Bun', 'Gluten-Free Bun (+$1.50)'],
      addOns: [
        { name: 'Extra Onion Rings Inside', price: 1.50 },
        { name: 'Smoked Gouda', price: 1.75 }
      ]
    }
  },
  {
    id: 'crispy-chicken-fillet',
    name: 'Crispy Chicken Fillet Burger',
    category: 'burgers',
    description: 'Buttermilk 24-hr brined chicken breast, creamy herb slaw, sweet butter pickles, garlic lemon mayo on toasted sesame bun.',
    price: 11.49,
    calories: 640,
    image: 'https://images.unsplash.com/photo-1606755962773-d324e0a13086?auto=format&fit=crop&w=1200&q=80',
    spiceLevel: 0,
    isVeg: false,
    badge: 'New',
    customization: {
      sizes: [
        { name: 'Standard Fillet', priceDelta: 0 },
        { name: 'Double Crunchy Fillet', priceDelta: 3.75 }
      ],
      addOns: [
        { name: 'Honey Mustard Dip', price: 0.75 },
        { name: 'Sharp Cheddar', price: 1.50 }
      ]
    }
  },
  {
    id: 'mushroom-swiss-burger',
    name: 'Mushroom Swiss Burger',
    category: 'burgers',
    description: 'Sautéed wild cremini & shiitake mushrooms in thyme butter, melted aged Swiss Emmental, black pepper truffle aioli.',
    price: 13.29,
    calories: 760,
    image: 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format&fit=crop&w=1200&q=80',
    spiceLevel: 0,
    isVeg: false,
    customization: {
      sizes: [
        { name: 'Single Patty', priceDelta: -2.00 },
        { name: 'Double Patty (Standard)', priceDelta: 0 }
      ],
      addOns: [
        { name: 'Extra Wild Mushrooms', price: 2.00 },
        { name: 'Crispy Bacon', price: 2.00 }
      ]
    }
  },
  {
    id: 'veggie-delight-burger',
    name: 'Veggie Delight Burger',
    category: 'burgers',
    description: 'House plant-based flame-seared patty, ripe Hass avocado, heirloom tomato, baby arugula, sun-dried tomato pesto on vegan brioche.',
    price: 12.19,
    calories: 520,
    image: 'https://images.unsplash.com/photo-1525059696034-4967a8e1dca2?auto=format&fit=crop&w=1200&q=80',
    spiceLevel: 0,
    isVeg: true,
    badge: 'New',
    customization: {
      bunTypes: ['Vegan Brioche', 'Gluten-Free Bun', 'Lettuce Wrap'],
      addOns: [
        { name: 'Vegan Smoked Gouda', price: 1.75 },
        { name: 'Pickled Red Onions', price: 0.75 }
      ]
    }
  },

  // ================= FRIED CHICKEN =================
  {
    id: 'nashville-hot-tenders',
    name: 'Nashville Hot Tenders (Nashville After Dark)',
    category: 'chicken',
    description: 'Crispy buttermilk tenders drenched in cayenne-infused hot oil, dusted with Nashville spice blend. Served with toast & pickles.',
    price: 14.49,
    calories: 780,
    image: 'https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=1200&q=80',
    isSpicy: true,
    spiceLevel: 3,
    isVeg: false,
    badge: 'Best Seller',
    popular: true,
    customization: {
      sizes: [
        { name: '4 Pcs Tender Box', priceDelta: 0 },
        { name: '8 Pcs Heavy Feast', priceDelta: 6.50 }
      ],
      spiceLevels: ['Mild Heat', 'Nashville Blaze', 'Reaper Level X']
    }
  },
  {
    id: 'original-crispy-wings',
    name: 'Original Crispy Wings',
    category: 'chicken',
    description: 'Triple-dredged golden wings tossed in sea salt & cracked black pepper, ultra-crisp crunch with tender juicy center.',
    price: 11.99,
    calories: 620,
    image: 'https://images.unsplash.com/photo-1762631883174-6ea8c0cdc5ba?auto=format&fit=crop&w=1200&q=80',
    spiceLevel: 0,
    isVeg: false,
    customization: {
      sizes: [
        { name: '6 Pieces', priceDelta: 0 },
        { name: '12 Pieces', priceDelta: 8.00 }
      ],
      addOns: [
        { name: 'Signature Blaze Sauce', price: 1.50 },
        { name: 'Honey Mustard', price: 1.25 },
        { name: 'BBQ Sauce', price: 1.25 },
        { name: 'Buffalo Ranch Dip', price: 1.75 },
        { name: 'Garlic Mayo Dip', price: 1.25 }
      ]
    }
  },
  {
    id: 'spicy-buffalo-wings',
    name: 'Spicy Buffalo Wings',
    category: 'chicken',
    description: 'Crispy chicken wings drenched in tangy New York aged cayenne butter sauce. Served with blue cheese dip & celery crunch.',
    price: 12.99,
    calories: 690,
    image: 'https://images.unsplash.com/photo-1712286928542-17af515d3dcd?auto=format&fit=crop&w=1200&q=80',
    isSpicy: true,
    spiceLevel: 2,
    isVeg: false,
    badge: 'Popular',
    customization: {
      sizes: [
        { name: '6 Pieces', priceDelta: 0 },
        { name: '12 Pieces', priceDelta: 8.50 }
      ]
    }
  },
  {
    id: 'zinger-fillet-strips',
    name: 'Zinger Fillet Strips',
    category: 'chicken',
    description: 'Hand-breaded premium chicken breast strips with a signature spicy habanero kick, served with smoked honey mustard.',
    price: 10.49,
    calories: 540,
    image: 'https://images.unsplash.com/photo-1585325701165-351af916e581?auto=format&fit=crop&w=1200&q=80',
    isSpicy: true,
    spiceLevel: 2,
    isVeg: false
  },
  {
    id: 'bucket-deal-16pc',
    name: 'Mega Chicken Bucket (16 Pcs)',
    category: 'chicken',
    description: 'A monster feast of drumsticks, thighs & wings in our secret 11-spice recipe, accompanied by 4 signature Blaze dips.',
    price: 28.99,
    calories: 1980,
    image: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=1200&q=80',
    isVeg: false,
    badge: "Chef's Pick",
    customization: {
      sizes: [
        { name: '8 Pieces Bucket', priceDelta: -11.00 },
        { name: '16 Pieces Bucket (Standard)', priceDelta: 0 },
        { name: '20 Pieces Party Bucket', priceDelta: 6.00 }
      ]
    }
  },
  {
    id: 'boneless-bites',
    name: 'Boneless Popcorn Bites',
    category: 'chicken',
    description: 'Bite-sized crispy tender chicken morsels dusted in smoked paprika & parmesan powder. Maximum dipping pleasure.',
    price: 8.99,
    calories: 460,
    image: 'https://images.unsplash.com/photo-1541832676-9b763b0239ab?auto=format&fit=crop&w=1200&q=80',
    isVeg: false
  },

  // ================= WRAPS & ROLLS =================
  {
    id: 'zinger-wrap',
    name: 'Zinger Crunch Wrap',
    category: 'wraps',
    description: 'Spicy crispy chicken strips, melted cheese, shredded romaine, diced tomatoes, chipotle fire sauce folded in a grilled tortilla.',
    price: 10.99,
    calories: 610,
    image: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?auto=format&fit=crop&w=1200&q=80',
    isSpicy: true,
    spiceLevel: 2,
    isVeg: false,
    badge: 'Best Seller'
  },
  {
    id: 'grilled-chicken-caesar-wrap',
    name: 'Grilled Chicken Caesar Wrap',
    category: 'wraps',
    description: 'Char-grilled herb chicken breast, shaved Grana Padano parmesan, crisp romaine, house garlic Caesar dressing in sun-dried tomato wrap.',
    price: 10.49,
    calories: 530,
    image: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&w=1200&q=80',
    isVeg: false
  },
  {
    id: 'bbq-beef-roll',
    name: 'Slow-Smoked BBQ Beef Roll',
    category: 'wraps',
    description: '14-hr smoked pulled brisket, tangy cider slaw, charred scallions, dark molasses BBQ glaze in a toasted artisan roll.',
    price: 12.99,
    calories: 690,
    image: 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?auto=format&fit=crop&w=1200&q=80',
    isVeg: false,
    badge: 'New'
  },
  {
    id: 'falafel-veggie-wrap',
    name: 'Falafel Green Goddess Wrap',
    category: 'wraps',
    description: 'Crispy spiced chickpea falafels, cucumber ribbons, pickled turnips, fresh mint, creamy lemon tahini in toasted lavash flatbread.',
    price: 9.99,
    calories: 470,
    image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=1200&q=80',
    isVeg: true
  },

  // ================= SIDES =================
  {
    id: 'fries-peri-peri-loaded',
    name: 'Peri-Peri Loaded Cheese Fries',
    category: 'sides',
    description: 'Skin-on rustic fries dusted in spicy peri-peri dust, smothered in liquid cheddar, crispy bacon bits, jalapeños & chives.',
    price: 7.99,
    calories: 580,
    image: 'https://images.unsplash.com/photo-1585109649139-366815a0d713?auto=format&fit=crop&w=1200&q=80',
    isSpicy: true,
    spiceLevel: 2,
    badge: 'Best Seller',
    popular: true
  },
  {
    id: 'fries-regular-rustic',
    name: 'Signature Sea Salt Fries',
    category: 'sides',
    description: 'Double-fried Idaho Russet potatoes with Maldon flaked sea salt & rosemary essence.',
    price: 4.49,
    calories: 340,
    image: 'https://images.unsplash.com/photo-1463183665146-ce2ed31df6b0?auto=format&fit=crop&w=1200&q=80',
    isVeg: true
  },
  {
    id: 'cheese-sticks',
    name: 'Molten Mozzarella Sticks',
    category: 'sides',
    description: 'Herb-crusted Wisconsin mozzarella with an epic cheese pull, served with warm San Marzano marinara.',
    price: 6.99,
    calories: 420,
    image: 'https://images.unsplash.com/photo-1531749668029-2db88e4276c7?auto=format&fit=crop&w=1200&q=80',
    isVeg: true
  },
  {
    id: 'onion-rings-beer-battered',
    name: 'Beer-Battered Onion Rings',
    category: 'sides',
    description: 'Thick jumbo sweet onions dunked in craft IPA batter, fried glass-crisp. Served with smoked paprika remoulade.',
    price: 5.99,
    calories: 380,
    image: 'https://images.unsplash.com/photo-1766589152292-3c052f0d87aa?auto=format&fit=crop&w=1200&q=80',
    isVeg: true
  },
  {
    id: 'mac-and-cheese-bites',
    name: 'Truffle Mac & Cheese Bites',
    category: 'sides',
    description: 'Crispy panko spheres filled with four-cheese macaroni & black truffle cream.',
    price: 7.49,
    calories: 490,
    image: 'https://images.unsplash.com/photo-1543339308-43e59d6b73a6?auto=format&fit=crop&w=1200&q=80',
    isVeg: true,
    badge: 'New'
  },
  {
    id: 'garlic-parmesan-bread',
    name: 'Charred Garlic Parmesan Bread',
    category: 'sides',
    description: 'Thick toasted sourdough baguette steeped in roasted garlic herb butter and aged pecorino.',
    price: 4.99,
    calories: 310,
    image: 'https://images.unsplash.com/photo-1556008531-57e6eefc7be4?auto=format&fit=crop&w=1200&q=80',
    isVeg: true
  },

  // ================= SALADS =================
  {
    id: 'grilled-chicken-avocado-salad',
    name: 'Grilled Chicken Harvest Salad',
    category: 'salads',
    description: 'Fire-grilled chicken strips, organic greens, Hass avocado, cherry tomatoes, toasted pepitas, citrus balsamic vinaigrette.',
    price: 11.99,
    calories: 410,
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1200&q=80',
    isVeg: false
  },
  {
    id: 'caesar-supreme-salad',
    name: 'Caesar Supreme Salad',
    category: 'salads',
    description: 'Crispy baby romaine hearts, sourdough croutons, shaved parmesan reggiano, soft-boiled egg, creamy anchovy emulsion.',
    price: 9.49,
    calories: 360,
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=80',
    isVeg: true
  },
  {
    id: 'fresh-garden-greens',
    name: 'Fresh Garden Greens Bowl',
    category: 'salads',
    description: 'Cucumber, radish, cherry heirloom tomatoes, kalamata olives, crumbled Greek feta, oregano lemon vinaigrette.',
    price: 8.49,
    calories: 280,
    image: 'https://images.unsplash.com/photo-1601579112759-761ccbaa8bde?auto=format&fit=crop&w=1200&q=80',
    isVeg: true
  },

  // ================= COMBOS & DEALS =================
  {
    id: 'solo-smash-deal',
    name: 'Solo Blaze Box',
    category: 'combos',
    description: 'Classic Smash Burger or Zinger Burger + Regular Sea Salt Fries + 1 Chilled Beverage of choice.',
    price: 15.99,
    calories: 1040,
    image: 'https://images.unsplash.com/photo-1763689389824-dd2cea2e5772?auto=format&fit=crop&w=1200&q=80',
    badge: 'Best Seller',
    popular: true
  },
  {
    id: 'duo-flame-deal',
    name: 'Duo Flame Deal (Save 20%)',
    category: 'combos',
    description: '2 Burgers of choice + Large Loaded Peri-Peri Fries + 2 Milkshakes or Soft Drinks.',
    price: 27.99,
    calories: 1890,
    image: 'https://images.unsplash.com/photo-1635126039215-ec4d113917fd?auto=format&fit=crop&w=1200&q=80',
    badge: 'Popular',
    popular: true
  },
  {
    id: 'family-feast-megapack',
    name: 'Family Feast Megapack (Serves 4–6)',
    category: 'combos',
    description: '12 Pcs Crispy Chicken + 2 Smash Burgers + 2 Loaded Fries + 4 Drinks + 1 Brownie Sundae.',
    price: 49.99,
    calories: 3450,
    image: 'https://images.unsplash.com/photo-1627662055487-551888db3aa8?auto=format&fit=crop&w=1200&q=80',
    badge: "Chef's Pick"
  },
  {
    id: 'student-blaze-deal',
    name: 'Student Pocket Deal',
    category: 'combos',
    description: '1 Single Smash Burger + Regular Fries + Drink + Free Blaze Dip. High value, maximum taste.',
    price: 11.49,
    calories: 820,
    image: 'https://images.unsplash.com/photo-1725839134568-2aff8d21df47?auto=format&fit=crop&w=1200&q=80'
  },

  // ================= BEVERAGES =================
  {
    id: 'shake-oreo-obsession',
    name: 'Oreo Obsession Handspun Shake',
    category: 'beverages',
    description: 'Premium Madagascar vanilla bean ice cream spun with double-stuf Oreos, topped with whipped cream & dark cookie crumble.',
    price: 6.99,
    calories: 590,
    image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=1200&q=80',
    badge: 'Best Seller',
    popular: true
  },
  {
    id: 'shake-chocolate-fudge',
    name: 'Valrhona Triple Chocolate Shake',
    category: 'beverages',
    description: 'Rich 70% dark chocolate gelato, warm fudge ribbons, cocoa nib crunch, gold-dusted whipped cream.',
    price: 6.99,
    calories: 620,
    image: 'https://images.unsplash.com/photo-1579954115545-a95591f28bfc?auto=format&fit=crop&w=1200&q=80'
  },
  {
    id: 'shake-strawberry-shortcake',
    name: 'Fresh Strawberry Shortcake Shake',
    category: 'beverages',
    description: 'Hand-crushed ripe Camarosa strawberries, sweet cream ice cream, butter crumble topping.',
    price: 6.99,
    calories: 510,
    image: 'https://images.unsplash.com/photo-1553787499-6f9133860278?auto=format&fit=crop&w=1200&q=80'
  },
  {
    id: 'fresh-squeezed-lemonade',
    name: 'Craft Fire Lemonade',
    category: 'beverages',
    description: 'Fresh hand-squeezed Meyer lemons, crushed mint leaves, cane sugar and subtle sparkling water.',
    price: 4.29,
    calories: 140,
    image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=1200&q=80'
  },
  {
    id: 'iced-hibiscus-tea',
    name: 'Artisan Iced Hibiscus Peach Tea',
    category: 'beverages',
    description: 'Cold-brewed botanical hibiscus tea infused with white peach puree and orange peel.',
    price: 4.29,
    calories: 90,
    image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=1200&q=80'
  },
  {
    id: 'nitro-cold-brew',
    name: 'Nitro Cold Brew Coffee',
    category: 'beverages',
    description: 'Single-origin Ethiopian cold brew infused with nitrogen for a velvety stout-like foam head.',
    price: 4.99,
    calories: 10,
    image: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=1200&q=80'
  },

  // ================= DESSERTS =================
  {
    id: 'chocolate-lava-cake',
    name: 'Molten Dark Chocolate Lava Cake',
    category: 'desserts',
    description: 'Warm baked Belgian chocolate cake with an oozing liquid center, served with cold Madagascar vanilla bean custard.',
    price: 7.99,
    calories: 520,
    image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=1200&q=80',
    badge: 'Best Seller',
    popular: true
  },
  {
    id: 'brownie-sundae-supreme',
    name: 'Skillet Brownie Sundae',
    category: 'desserts',
    description: 'Fudgy walnut brownie warmed in a skillet, topped with salted caramel gelato, hot fudge & toasted marshmallows.',
    price: 8.49,
    calories: 680,
    image: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=1200&q=80',
    badge: "Chef's Pick"
  },
  {
    id: 'apple-pie-caramel',
    name: 'Spiced Dutch Apple Pie',
    category: 'desserts',
    description: 'Cinnamon caramelized Granny Smith apples inside flaky golden lattice crust with bourbon caramel drizzle.',
    price: 6.99,
    calories: 440,
    image: 'https://images.unsplash.com/photo-1568571780765-9276ac8b75a2?auto=format&fit=crop&w=1200&q=80'
  },
  {
    id: 'soft-serve-ice-cream',
    name: 'Blaze Swirl Soft Serve Cone',
    category: 'desserts',
    description: 'Double swirl of sweet cream & burnt honey honeycomb inside a black waffle charcoal cone.',
    price: 4.49,
    calories: 260,
    image: 'https://images.unsplash.com/photo-1501443762994-82bd5dace89a?auto=format&fit=crop&w=1200&q=80',
    badge: 'New'
  },

  // ================= SAUCES & DIPS =================
  {
    id: 'sauce-signature-blaze',
    name: 'Signature Blaze Sauce',
    category: 'dips',
    description: 'Our secret 12-ingredient condiment with roasted garlic, smoked paprika, sweet relish and chipotle fire.',
    price: 1.50,
    calories: 120,
    image: 'https://images.unsplash.com/photo-1472476443507-c7a5948772fc?auto=format&fit=crop&w=1200&q=80',
    isSpicy: true,
    spiceLevel: 2,
    badge: 'Best Seller'
  },
  {
    id: 'sauce-garlic-truffle-mayo',
    name: 'Roasted Garlic Truffle Mayo',
    category: 'dips',
    description: 'Slow-roasted confit garlic blended with black truffle oil and creamy egg yolk emulsion.',
    price: 1.50,
    calories: 140,
    image: 'https://images.unsplash.com/photo-1528751014936-863e6e7a319c?auto=format&fit=crop&w=1200&q=80'
  },
  {
    id: 'sauce-bourbon-bbq',
    name: 'Smoked Bourbon BBQ Sauce',
    category: 'dips',
    description: 'Kentucky bourbon reduction simmered with molasses, apple cider vinegar, and hickory smoke.',
    price: 1.25,
    calories: 90,
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1200&q=80'
  },
  {
    id: 'sauce-ghost-pepper-hot',
    name: 'Inferno Ghost Pepper Dip',
    category: 'dips',
    description: 'Extreme heat warning! Pure Bhut Jolokia chillies balanced with charred pineapple and lime.',
    price: 1.75,
    calories: 60,
    isSpicy: true,
    spiceLevel: 3,
    image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=1200&q=80'
  },

  // ================= PIZZA =================
  {
    id: 'pizza-margherita-classic',
    name: 'Margherita Classic',
    category: 'pizza',
    description: 'Fresh mozzarella, basil, San Marzano tomato sauce on hand-stretched wood-fired dough.',
    price: 11.5,
    calories: 780,
    isVeg: true,
    badge: 'Popular',
    image: 'https://images.unsplash.com/photo-1772494047915-79042d21eb09?auto=format&fit=crop&w=1200&q=80',
    customization: {
      sizes: [
        { name: 'Small 9"', priceDelta: -3.00 },
        { name: 'Medium 12" (Standard)', priceDelta: 0 },
        { name: 'Large 15"', priceDelta: 4.00 }
      ],
      addOns: [
        { name: 'Signature Blaze Sauce', price: 1.50 },
        { name: 'Honey Mustard', price: 1.25 },
        { name: 'Buffalo Ranch Dip', price: 1.75 },
        { name: 'Cheese Dip', price: 2.00 },
        { name: 'Garlic Mayo Dip', price: 1.25 }
      ]
    }
  },
  {
    id: 'pizza-pepperoni-feast',
    name: 'Pepperoni Feast',
    category: 'pizza',
    description: 'Double pepperoni, mozzarella, oregano on a crisp blistered crust.',
    price: 13.5,
    calories: 950,
    badge: 'Best Seller',
    popular: true,
    image: 'https://images.unsplash.com/photo-1571407921708-4202261ea9e9?auto=format&fit=crop&w=1200&q=80',
    customization: {
      sizes: [
        { name: 'Small 9"', priceDelta: -3.00 },
        { name: 'Medium 12" (Standard)', priceDelta: 0 },
        { name: 'Large 15"', priceDelta: 4.00 }
      ],
      addOns: [
        { name: 'Signature Blaze Sauce', price: 1.50 },
        { name: 'Honey Mustard', price: 1.25 },
        { name: 'Buffalo Ranch Dip', price: 1.75 },
        { name: 'Cheese Dip', price: 2.00 },
        { name: 'Garlic Mayo Dip', price: 1.25 }
      ]
    }
  },
  {
    id: 'pizza-bbq-chicken',
    name: 'BBQ Chicken Pizza',
    category: 'pizza',
    description: 'Grilled chicken, red onion, BBQ drizzle, mozzarella.',
    price: 14.25,
    calories: 900,
    image: 'https://images.unsplash.com/photo-1767065603116-8cee3bf11372?auto=format&fit=crop&w=1200&q=80',
    customization: {
      sizes: [
        { name: 'Small 9"', priceDelta: -3.00 },
        { name: 'Medium 12" (Standard)', priceDelta: 0 },
        { name: 'Large 15"', priceDelta: 4.00 }
      ],
      addOns: [
        { name: 'Signature Blaze Sauce', price: 1.50 },
        { name: 'Honey Mustard', price: 1.25 },
        { name: 'Buffalo Ranch Dip', price: 1.75 },
        { name: 'Cheese Dip', price: 2.00 },
        { name: 'Garlic Mayo Dip', price: 1.25 }
      ]
    }
  },
  {
    id: 'pizza-four-cheese',
    name: 'Four Cheese Pizza',
    category: 'pizza',
    description: 'Mozzarella, cheddar, parmesan, gorgonzola — a molten four-cheese blend.',
    price: 13.75,
    calories: 920,
    isVeg: true,
    image: 'https://images.unsplash.com/photo-1598206572429-f02335a5edc6?auto=format&fit=crop&w=1200&q=80',
    customization: {
      sizes: [
        { name: 'Small 9"', priceDelta: -3.00 },
        { name: 'Medium 12" (Standard)', priceDelta: 0 },
        { name: 'Large 15"', priceDelta: 4.00 }
      ],
      addOns: [
        { name: 'Signature Blaze Sauce', price: 1.50 },
        { name: 'Honey Mustard', price: 1.25 },
        { name: 'Buffalo Ranch Dip', price: 1.75 },
        { name: 'Cheese Dip', price: 2.00 },
        { name: 'Garlic Mayo Dip', price: 1.25 }
      ]
    }
  },
  {
    id: 'pizza-veggie-supreme',
    name: 'Veggie Supreme',
    category: 'pizza',
    description: 'Bell peppers, mushrooms, olives, onion, corn over creamy mozzarella.',
    price: 12.5,
    calories: 720,
    isVeg: true,
    image: 'https://images.unsplash.com/photo-1743615357602-f0711d1bc06f?auto=format&fit=crop&w=1200&q=80',
    customization: {
      sizes: [
        { name: 'Small 9"', priceDelta: -3.00 },
        { name: 'Medium 12" (Standard)', priceDelta: 0 },
        { name: 'Large 15"', priceDelta: 4.00 }
      ],
      addOns: [
        { name: 'Signature Blaze Sauce', price: 1.50 },
        { name: 'Honey Mustard', price: 1.25 },
        { name: 'Buffalo Ranch Dip', price: 1.75 },
        { name: 'Cheese Dip', price: 2.00 },
        { name: 'Garlic Mayo Dip', price: 1.25 }
      ]
    }
  },
  {
    id: 'pizza-spicy-peri-chicken',
    name: 'Spicy Peri-Peri Chicken Pizza',
    category: 'pizza',
    description: 'Peri-peri grilled chicken, jalapeños, mozzarella — real heat from the grill.',
    price: 14.75,
    calories: 880,
    isSpicy: true,
    spiceLevel: 2,
    image: 'https://images.unsplash.com/photo-1773620497483-aafa93392160?auto=format&fit=crop&w=1200&q=80',
    customization: {
      sizes: [
        { name: 'Small 9"', priceDelta: -3.00 },
        { name: 'Medium 12" (Standard)', priceDelta: 0 },
        { name: 'Large 15"', priceDelta: 4.00 }
      ],
      addOns: [
        { name: 'Signature Blaze Sauce', price: 1.50 },
        { name: 'Honey Mustard', price: 1.25 },
        { name: 'Buffalo Ranch Dip', price: 1.75 },
        { name: 'Cheese Dip', price: 2.00 },
        { name: 'Garlic Mayo Dip', price: 1.25 }
      ]
    }
  },
  {
    id: 'pizza-meat-lovers',
    name: 'Meat Lovers Pizza',
    category: 'pizza',
    description: 'Pepperoni, sausage, ground beef, bacon loaded over bubbling mozzarella.',
    price: 15.5,
    calories: 1100,
    image: 'https://images.unsplash.com/photo-1773620494344-a9b87d73031b?auto=format&fit=crop&w=1200&q=80',
    customization: {
      sizes: [
        { name: 'Small 9"', priceDelta: -3.00 },
        { name: 'Medium 12" (Standard)', priceDelta: 0 },
        { name: 'Large 15"', priceDelta: 4.00 }
      ],
      addOns: [
        { name: 'Signature Blaze Sauce', price: 1.50 },
        { name: 'Honey Mustard', price: 1.25 },
        { name: 'Buffalo Ranch Dip', price: 1.75 },
        { name: 'Cheese Dip', price: 2.00 },
        { name: 'Garlic Mayo Dip', price: 1.25 }
      ]
    }
  },
  {
    id: 'pizza-hawaiian',
    name: 'Hawaiian Pizza',
    category: 'pizza',
    description: 'Smoked ham, sweet pineapple, mozzarella.',
    price: 12.75,
    calories: 840,
    image: 'https://images.unsplash.com/photo-1778448951072-e0c42bbcb93b?auto=format&fit=crop&w=1200&q=80',
    customization: {
      sizes: [
        { name: 'Small 9"', priceDelta: -3.00 },
        { name: 'Medium 12" (Standard)', priceDelta: 0 },
        { name: 'Large 15"', priceDelta: 4.00 }
      ],
      addOns: [
        { name: 'Signature Blaze Sauce', price: 1.50 },
        { name: 'Honey Mustard', price: 1.25 },
        { name: 'Buffalo Ranch Dip', price: 1.75 },
        { name: 'Cheese Dip', price: 2.00 },
        { name: 'Garlic Mayo Dip', price: 1.25 }
      ]
    }
  },

  // ================= DIPS & SAUCES =================
  {
    id: 'dip-cheese',
    name: 'Cheese Dip',
    category: 'dips',
    description: 'Warm melted cheddar-jack blend.',
    price: 2.0,
    calories: 220,
    isVeg: true,
    image: 'https://images.unsplash.com/photo-1695886135860-2fe067db2fb8?auto=format&fit=crop&w=1200&q=80'
  },
  {
    id: 'dip-buffalo-ranch',
    name: 'Buffalo Ranch Dip',
    category: 'dips',
    description: 'Buffalo hot sauce blended with cool ranch.',
    price: 1.75,
    calories: 120,
    isSpicy: true,
    spiceLevel: 1,
    image: 'https://images.unsplash.com/photo-1688059187289-a920f4e4ff95?auto=format&fit=crop&w=1200&q=80'
  },
  {
    id: 'dip-honey-mustard',
    name: 'Honey Mustard',
    category: 'dips',
    description: 'Sweet and tangy honey mustard.',
    price: 1.25,
    calories: 100,
    image: 'https://images.unsplash.com/photo-1654515722385-c684c5331c04?auto=format&fit=crop&w=1200&q=80'
  },
  {
    id: 'dip-marinara',
    name: 'Marinara Dip',
    category: 'dips',
    description: 'Warm tomato basil marinara.',
    price: 1.25,
    calories: 60,
    isVeg: true,
    image: 'https://images.unsplash.com/photo-1604579659931-f42436a8368c?auto=format&fit=crop&w=1200&q=80'
  },
  {
    id: 'dip-spicy-jalapeno',
    name: 'Spicy Jalapeño Dip',
    category: 'dips',
    description: 'Roasted jalapeño cream dip, real heat.',
    price: 1.75,
    calories: 140,
    isSpicy: true,
    spiceLevel: 2,
    image: 'https://images.unsplash.com/photo-1533841175647-39fea57b86ba?auto=format&fit=crop&w=1200&q=80'
  }
];

export const CATEGORIES = [
  { id: 'all', name: 'All Fire', icon: '🔥' },
  { id: 'burgers', name: 'Burgers', icon: '🍔' },
  { id: 'chicken', name: 'Fried Chicken', icon: '🍗' },
  { id: 'wraps', name: 'Wraps & Rolls', icon: '🌯' },
  { id: 'sides', name: 'Sides', icon: '🍟' },
  { id: 'salads', name: 'Salads', icon: '🥗' },
  { id: 'combos', name: 'Deals & Combos', icon: '⚡' },
  { id: 'beverages', name: 'Beverages', icon: '🥤' },
  { id: 'desserts', name: 'Desserts', icon: '🍰' },
  { id: 'pizza', name: 'Pizza', icon: '🍕' },
  { id: 'dips', name: 'Dips & Sauces', icon: '🥫' },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]['id'];

/** Curated "Best Sellers & Chef's Picks" — larger cards above the full menu. */
export const FEATURED_IDS = [
  'classic-smash-burger',
  'nashville-hot-tenders',
  'pizza-pepperoni-feast',
  'shake-oreo-obsession',
] as const;

export const FEATURED_ITEMS = FEATURED_IDS.map((id) => MENU_ITEMS.find((m) => m.id === id)).filter(
  (m): m is MenuItem => Boolean(m)
);

/** Dining-flow order categories appear as labeled sections + sub-nav entries. */
export const SECTION_ORDER = [
  'burgers',
  'chicken',
  'pizza',
  'wraps',
  'sides',
  'salads',
  'combos',
  'dips',
  'beverages',
  'desserts',
] as const;

/** Sub-nav entries derived from SECTION_ORDER, used by the sticky category bar. */
export const SUB_CATEGORIES = SECTION_ORDER.map((id) =>
  CATEGORIES.find((c) => c.id === id)
).filter((c) => c !== undefined) as { id: string; name: string; icon: string }[];

/** Group items into ordered category buckets (only categories that have items). */
export function getMenuSections(items: MenuItem[]): [string, MenuItem[]][] {
  const buckets = new Map<string, MenuItem[]>(SECTION_ORDER.map((id) => [id, []]));
  for (const item of items) {
    const list = buckets.get(item.category);
    if (list) list.push(item);
    else buckets.set(item.category, [item]);
  }
  return SECTION_ORDER.map((id) => [id, buckets.get(id) || []] as [string, MenuItem[]]).filter(
    ([, list]) => list.length > 0
  );
}
