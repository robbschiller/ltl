import type { Game } from './nhlApi'
import {
  getScheduleForDate,
  getTodaySchedule,
  getRedWingsCurrentSeasonSchedule,
} from './nhlApi'

const RED_WINGS_ABBREV = 'DET'

const isRedWingsGame = (game: Game) =>
  game.awayTeam.abbrev === RED_WINGS_ABBREV || game.homeTeam.abbrev === RED_WINGS_ABBREV

const isUpcomingState = (game: Game) => game.gameState === 'FUT' || game.gameState === 'PRE'

const isFutureGame = (game: Game, now: number) =>
  new Date(game.startTimeUTC).getTime() > now

export async function getUpcomingRedWingsGame(dateParam?: string): Promise<Game | null> {
  const now = Date.now()

  if (dateParam) {
    const schedule = await getScheduleForDate(dateParam)
    return schedule.gameWeek.flatMap((week) => week.games).find(isRedWingsGame) || null
  }

  const todaySchedule = await getTodaySchedule()
  const allRedWingsGames = todaySchedule.gameWeek
    .flatMap((week) => week.games)
    .filter(isRedWingsGame)

  const upcomingGames = allRedWingsGames.filter(
    (game) => isUpcomingState(game) || isFutureGame(game, now),
  )

  if (upcomingGames.length > 0) {
    upcomingGames.sort(
      (a, b) => new Date(a.startTimeUTC).getTime() - new Date(b.startTimeUTC).getTime(),
    )
    return upcomingGames[0]
  }

  const seasonGames = await getRedWingsCurrentSeasonSchedule()
  const futureGames = seasonGames.filter(
    (game) => isUpcomingState(game) || isFutureGame(game, now),
  )

  if (futureGames.length > 0) {
    futureGames.sort(
      (a, b) => new Date(a.startTimeUTC).getTime() - new Date(b.startTimeUTC).getTime(),
    )
    return futureGames[0]
  }

  return null
}
