-- CreateTable
CREATE TABLE "Slate" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sport" TEXT NOT NULL DEFAULT 'NBA',
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "salaryCap" INTEGER NOT NULL DEFAULT 50000,
    "gameCount" INTEGER,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Slate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "slateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "team" TEXT NOT NULL,
    "opponent" TEXT NOT NULL,
    "positions" TEXT NOT NULL,
    "salary" INTEGER NOT NULL,
    "projectedPoints" DOUBLE PRECISION,
    "projectedMinutes" DOUBLE PRECISION,
    "floor" DOUBLE PRECISION,
    "ceiling" DOUBLE PRECISION,
    "value" DOUBLE PRECISION,
    "confidence" TEXT NOT NULL DEFAULT 'LOW',
    "dvpPtsAllowed" DOUBLE PRECISION,
    "oppDefEff" DOUBLE PRECISION,
    "vegasImplied" DOUBLE PRECISION,
    "vegasSpread" DOUBLE PRECISION,
    "vegasTotal" DOUBLE PRECISION,
    "usageBump" DOUBLE PRECISION,
    "boomProbability" DOUBLE PRECISION,
    "bustProbability" DOUBLE PRECISION,
    "leverageScore" DOUBLE PRECISION,
    "ownership" DOUBLE PRECISION,
    "avgFptsLast3" DOUBLE PRECISION,
    "avgFptsLast5" DOUBLE PRECISION,
    "avgFptsLast7" DOUBLE PRECISION,
    "avgFptsLast14" DOUBLE PRECISION,
    "avgFptsSeason" DOUBLE PRECISION,
    "per" DOUBLE PRECISION,
    "usageRate" DOUBLE PRECISION,
    "restDays" INTEGER,
    "isHome" BOOLEAN NOT NULL DEFAULT false,
    "injuryStatus" TEXT,
    "rawData" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoricalGame" (
    "id" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "playerId" TEXT,
    "team" TEXT NOT NULL,
    "opponent" TEXT NOT NULL,
    "gameDate" TIMESTAMP(3) NOT NULL,
    "season" TEXT NOT NULL,
    "isHome" BOOLEAN NOT NULL DEFAULT false,
    "minutes" DOUBLE PRECISION,
    "points" INTEGER,
    "rebounds" INTEGER,
    "assists" INTEGER,
    "steals" INTEGER,
    "blocks" INTEGER,
    "turnovers" INTEGER,
    "plusMinus" INTEGER,
    "fgMade" INTEGER,
    "fgAttempted" INTEGER,
    "fg3Made" INTEGER,
    "fg3Attempted" INTEGER,
    "ftMade" INTEGER,
    "ftAttempted" INTEGER,
    "usagePct" DOUBLE PRECISION,
    "trueShooting" DOUBLE PRECISION,
    "effectiveFg" DOUBLE PRECISION,
    "dkFantasyPoints" DOUBLE PRECISION NOT NULL,
    "restDays" INTEGER,
    "isBackToBack" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricalGame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamDefense" (
    "id" TEXT NOT NULL,
    "team" TEXT NOT NULL,
    "defEff" DOUBLE PRECISION NOT NULL,
    "offEff" DOUBLE PRECISION,
    "pace" DOUBLE PRECISION,
    "dvpPg" DOUBLE PRECISION,
    "dvpSg" DOUBLE PRECISION,
    "dvpSf" DOUBLE PRECISION,
    "dvpPf" DOUBLE PRECISION,
    "dvpC" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamDefense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lineup" (
    "id" TEXT NOT NULL,
    "slateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "totalSalary" INTEGER NOT NULL,
    "projectedPoints" DOUBLE PRECISION,
    "mode" TEXT NOT NULL DEFAULT 'CASH',
    "isOptimized" BOOLEAN NOT NULL DEFAULT false,
    "actualPoints" DOUBLE PRECISION,
    "contestId" TEXT,
    "placement" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lineup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LineupPlayer" (
    "id" TEXT NOT NULL,
    "lineupId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "slot" TEXT NOT NULL,

    CONSTRAINT "LineupPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "slateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "toolCalls" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectionAccuracy" (
    "id" TEXT NOT NULL,
    "slateId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "projectedPoints" DOUBLE PRECISION NOT NULL,
    "actualPoints" DOUBLE PRECISION,
    "error" DOUBLE PRECISION,
    "errorPct" DOUBLE PRECISION,
    "confidence" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectionAccuracy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BacktestRun" (
    "id" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "totalSlates" INTEGER NOT NULL,
    "meanError" DOUBLE PRECISION NOT NULL,
    "meanAbsError" DOUBLE PRECISION NOT NULL,
    "rmse" DOUBLE PRECISION,
    "r2" DOUBLE PRECISION,
    "byConfidence" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BacktestRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Slate_externalId_key" ON "Slate"("externalId");

-- CreateIndex
CREATE INDEX "Player_slateId_idx" ON "Player"("slateId");

-- CreateIndex
CREATE INDEX "Player_team_idx" ON "Player"("team");

-- CreateIndex
CREATE UNIQUE INDEX "Player_slateId_externalId_key" ON "Player"("slateId", "externalId");

-- CreateIndex
CREATE INDEX "HistoricalGame_playerName_idx" ON "HistoricalGame"("playerName");

-- CreateIndex
CREATE INDEX "HistoricalGame_gameDate_idx" ON "HistoricalGame"("gameDate");

-- CreateIndex
CREATE INDEX "HistoricalGame_team_idx" ON "HistoricalGame"("team");

-- CreateIndex
CREATE INDEX "HistoricalGame_opponent_idx" ON "HistoricalGame"("opponent");

-- CreateIndex
CREATE UNIQUE INDEX "HistoricalGame_playerName_team_gameDate_key" ON "HistoricalGame"("playerName", "team", "gameDate");

-- CreateIndex
CREATE UNIQUE INDEX "TeamDefense_team_key" ON "TeamDefense"("team");

-- CreateIndex
CREATE INDEX "Lineup_slateId_idx" ON "Lineup"("slateId");

-- CreateIndex
CREATE UNIQUE INDEX "LineupPlayer_lineupId_slot_key" ON "LineupPlayer"("lineupId", "slot");

-- CreateIndex
CREATE INDEX "ProjectionAccuracy_slateId_idx" ON "ProjectionAccuracy"("slateId");

-- CreateIndex
CREATE INDEX "ProjectionAccuracy_createdAt_idx" ON "ProjectionAccuracy"("createdAt");

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_slateId_fkey" FOREIGN KEY ("slateId") REFERENCES "Slate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lineup" ADD CONSTRAINT "Lineup_slateId_fkey" FOREIGN KEY ("slateId") REFERENCES "Slate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineupPlayer" ADD CONSTRAINT "LineupPlayer_lineupId_fkey" FOREIGN KEY ("lineupId") REFERENCES "Lineup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineupPlayer" ADD CONSTRAINT "LineupPlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
