/** Une inscription d'un pseudo : le premier créneau de la partie, et son titre. */
export type ParticipantSignUp = { timeSlotId: string; title: string };

/** Un pseudo, de participant ou de MJ, tel que la liste « Participants » le lit (ID-5). */
export type ParticipantRecord = {
  id: string;
  /** Le pseudo tel qu'il a été saisi. */
  nickname: string;
  gameMaster: boolean;
  linkedPhoneCount: number;
  /** Ses inscriptions, de secours comprises (IN-4), dans l'ordre où il les a prises. */
  signUps: ParticipantSignUp[];
};

/** Port de lecture des pseudos, implémenté par l'infrastructure. */
export interface ParticipantReader {
  /** Les pseudos, de participant et de MJ, dans l'ordre naturel. */
  list(): Promise<ParticipantRecord[]>;
}
