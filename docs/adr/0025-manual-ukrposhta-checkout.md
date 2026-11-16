# ADR 0025: Manual Ukrposhta checkout

The storefront offers Ukrposhta as a manual delivery method. Checkout requires a city and a numeric
branch number. The order stores them in the existing delivery snapshot under `UKRPOSHTA_BRANCH`.
The branch number remains a string to preserve leading zeros. The checkout total includes merchandise
and discounts. Customers pay the carrier separately for shipping.

Nova Poshta pickup points continue to use the carrier quote flow. Existing carrier-point orders
retain their stored selections and rates. The new method uses the existing order JSON field and
does not require a database migration. Deploy the gateway and orders service before enabling the new
checkout UI.
