"use client";

import { useEffect, useState } from "react";
import { getWishlist } from "../../lib/wishlist";

export function useWishlist(authUser) {
  const [wishlistStocks, setWishlistStocks] = useState([]);

  useEffect(() => {
    if (!authUser) {
      setWishlistStocks([]);
      return;
    }
    getWishlist().then(setWishlistStocks);
  }, [authUser]);

  return wishlistStocks;
}
