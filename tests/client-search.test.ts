import { test } from "node:test";
import assert from "node:assert/strict";
import { matchesClient } from "../src/lib/client-search.ts";
test("search handles accents, names in either order and identity", () => {
 const c={nombres:"José María",apellidos:"Pérez López",cedula:"0912345678"};
 for(const q of ["jose","PEREZ","lopez jose","09123","  ","maría pérez"]) assert.equal(matchesClient(c,q),true);
 assert.equal(matchesClient(c,"Ana"),false);
 assert.equal(matchesClient({},"Ana"),false);
});
