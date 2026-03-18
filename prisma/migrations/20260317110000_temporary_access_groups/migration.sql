ALTER TABLE "TemporaryAccess"
ADD COLUMN "groupId" TEXT;

UPDATE "TemporaryAccess" ta
SET "groupId" = ug."groupId"
FROM "VpnUserGroup" ug
WHERE ug."userId" = ta."userId"
  AND ug."id" = (
    SELECT ug2."id"
    FROM "VpnUserGroup" ug2
    WHERE ug2."userId" = ta."userId"
    ORDER BY ug2."createdAt" ASC
    LIMIT 1
  );

DELETE FROM "TemporaryAccess"
WHERE "groupId" IS NULL;

ALTER TABLE "TemporaryAccess"
ALTER COLUMN "groupId" SET NOT NULL;

ALTER TABLE "TemporaryAccess"
ADD CONSTRAINT "TemporaryAccess_groupId_fkey"
FOREIGN KEY ("groupId") REFERENCES "VpnGroup"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "TemporaryAccess_groupId_idx" ON "TemporaryAccess"("groupId");
