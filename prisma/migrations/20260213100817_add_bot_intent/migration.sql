-- CreateTable
CREATE TABLE "bot_intents" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "patterns" TEXT[],
    "response" TEXT NOT NULL,
    "quickReplies" TEXT[],
    "priority" INTEGER NOT NULL DEFAULT 50,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bot_intents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bot_intents_name_key" ON "bot_intents"("name");
