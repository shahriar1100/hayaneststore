import {
  categoryOptions,
  colourOptions,
  fabricOptions,
  priceOptions,
  type CatalogTaxonomy,
} from "@/data/shop-options";
import type { ShopFilters } from "@/lib/shop";

export function FilterFields({
  value,
  onChange,
  prefix,
  taxonomy,
}: {
  value: ShopFilters;
  onChange: (filters: ShopFilters) => void;
  prefix: string;
  taxonomy?: CatalogTaxonomy;
}) {
  const groups = [
    {
      key: "categories",
      label: "Category",
      options: taxonomy?.categories?.length ? taxonomy.categories : categoryOptions,
    },
    {
      key: "fabrics",
      label: "Fabric",
      options: taxonomy?.fabrics?.length ? taxonomy.fabrics : fabricOptions,
    },
    {
      key: "colours",
      label: "Colour",
      options: taxonomy?.colours?.length ? taxonomy.colours : colourOptions,
    },
  ] as const;

  return (
    <div className="shop-filter-fields">
      {groups.map((group) => <fieldset key={group.key}>
        <legend>{group.label}</legend>
        <div className={group.key === "colours" ? "shop-colour-options" : "shop-filter-options"}>
          {group.options.map((option) => {
            const selected: readonly string[] = value[group.key];
            return <label className="shop-filter-option" key={option.value}>
              <input type="checkbox" name={`${prefix}-${group.key}`} value={option.value} checked={selected.includes(option.value)} onChange={() => onChange({ ...value, [group.key]: selected.includes(option.value) ? selected.filter((item) => item !== option.value) : [...selected, option.value] })} />
              {"swatch" in option && <span className="shop-colour-swatch" style={{ background: String(option.swatch) }} aria-hidden="true" />}
              <span>{option.label}</span>
            </label>;
          })}
        </div>
      </fieldset>)}
      <fieldset>
        <legend>Price <span className="shop-filter-currency">BDT</span></legend>
        {priceOptions.map((option) => <label className="shop-filter-option" key={option.value}>
          <input type="radio" name={`${prefix}-price`} value={option.value} checked={value.price === option.value} onChange={() => onChange({ ...value, price: option.value })} />
          <span>{option.label}</span>
        </label>)}
      </fieldset>
    </div>
  );
}
