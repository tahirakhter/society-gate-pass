import { HouseRecord } from "@/lib/api";

export function formatHouseLabel(house: HouseRecord) {
  return house.block ? `${house.houseNumber} • Block ${house.block}` : house.houseNumber;
}

export function formatHousesSummary(houses: HouseRecord[]) {
  if (houses.length === 0) {
    return "No assigned homes";
  }

  if (houses.length === 1) {
    return formatHouseLabel(houses[0]);
  }

  const [firstHouse, ...otherHouses] = houses;
  return `${formatHouseLabel(firstHouse)} + ${otherHouses.length} more homes`;
}
