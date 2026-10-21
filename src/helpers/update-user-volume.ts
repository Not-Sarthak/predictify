import { incrementUserStats } from "../bot/utils/database/update-user-data";

export async function updateUserVolume(userId: number, volumeToAdd: number): Promise<void> {
    await incrementUserStats(userId, { totalVolume: volumeToAdd });
}
