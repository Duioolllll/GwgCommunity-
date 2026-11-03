import { createHash, randomBytes, randomUUID } from "node:crypto";

export type Role = "student" | "admin";
export type MarketStatus = "AVAILABLE" | "RESERVED" | "COMPLETED";
export type FinderKind = "lost" | "found";

export type User = {
  id: string;
  email: string;
  nickname: string;
  passwordHash: string;
  role: Role;
  status: "ACTIVE_STUDENT" | "SUSPENDED";
};

export type MarketPost = {
  id: string;
  authorId: string;
  title: string;
  description: string;
  price: number;
  category: string;
  status: MarketStatus;
  createdAt: string;
};

export type Club = {
  id: string;
  name: string;
  category: string;
  description: string;
  members: number;
  recruiting: boolean;
};

export type FinderPost = {
  id: string;
  authorId: string;
  kind: FinderKind;
  title: string;
  category: string;
  color: string;
  generalLocation: string;
  occurredAt: string;
  status: "ACTIVE" | "CLOSED";
};

export type ClubApplication = {
  id: string;
  clubId: string;
  applicantId: string;
  createdAt: string;
  status: "SUBMITTED";
};

type Invitation = {
  id: string;
  codeHash: string;
  expiresAt: string;
  usedAt?: string;
  redeemedBy?: string;
  revokedAt?: string;
};

type Session = { userId: string; expiresAt: number };

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const passwordHash = (value: string) => hash(`password:${value}`);

const state = globalThis as typeof globalThis & {
  __gwgStore?: {
    users: User[];
    invitations: Invitation[];
    market: MarketPost[];
    clubs: Club[];
    finder: FinderPost[];
    applications: ClubApplication[];
    sessions: Map<string, Session>;
  };
};

const seed = (): NonNullable<typeof state.__gwgStore> => ({
  users: [
    {
      id: "admin",
      email: "admin@gwg.local",
      nickname: "관리자",
      passwordHash: passwordHash("admin1234"),
      role: "admin",
      status: "ACTIVE_STUDENT",
    },
  ],
  invitations: [],
  market: [
    { id: "market-1", authorId: "admin", title: "문제집 / 수학의 정석", description: "상태 좋은 문제집입니다.", price: 5000, category: "책·교재", status: "AVAILABLE", createdAt: new Date().toISOString() },
    { id: "market-2", authorId: "admin", title: "체육복 상의 100", description: "깨끗하게 보관했습니다.", price: 8000, category: "의류", status: "AVAILABLE", createdAt: new Date().toISOString() },
    { id: "market-3", authorId: "admin", title: "과학 실험 키트", description: "필요한 학생에게 나눔합니다.", price: 0, category: "나눔", status: "AVAILABLE", createdAt: new Date().toISOString() },
  ],
  clubs: [
    { id: "club-1", name: "GDSC Gwangdeok", category: "IT·개발", description: "기술로 학교의 문제를 해결하는 학생 개발 커뮤니티", members: 12, recruiting: true },
    { id: "club-2", name: "광덕 영상 제작소", category: "예술·미디어", description: "카메라와 편집으로 우리의 이야기를 기록합니다.", members: 8, recruiting: true },
    { id: "club-3", name: "책과 사람들", category: "인문·사회", description: "한 달에 한 권, 함께 읽고 깊이 이야기합니다.", members: 15, recruiting: false },
  ],
  finder: [],
  applications: [],
  sessions: new Map(),
});

export const db = state.__gwgStore ?? (state.__gwgStore = seed());

export function createInvitation() {
  const code = randomBytes(16).toString("hex");
  db.invitations.push({
    id: randomUUID(),
    codeHash: hash(code),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });
  return code;
}

export function redeemInvitation(code: string) {
  const invitation = db.invitations.find((item) => item.codeHash === hash(code));
  if (!invitation || invitation.usedAt || invitation.revokedAt || new Date(invitation.expiresAt) < new Date()) return false;
  return invitation;
}

export function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  db.sessions.set(token, { userId, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 });
  return token;
}

export function getUser(token?: string) {
  if (!token) return undefined;
  const session = db.sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    db.sessions.delete(token);
    return undefined;
  }
  return db.users.find((user) => user.id === session.userId);
}

export { hash, passwordHash, randomUUID };
