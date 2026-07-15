-- CreateTable
CREATE TABLE "customers" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "telepules" TEXT NOT NULL,
    "lat" DECIMAL(9,6),
    "lon" DECIMAL(9,6),
    "budget" INTEGER,
    "note" TEXT,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_name_key" ON "customers"("name");

