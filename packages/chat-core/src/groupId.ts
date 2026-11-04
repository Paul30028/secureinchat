/** 群 id 校验：存储键用冒号分段，群 id 里有冒号会让「属于哪个群」的判断出错。 */
export class InvalidGroupIdError extends Error {
  constructor() {
    super("groupId 不能为空，也不能包含冒号");
    this.name = "InvalidGroupIdError";
  }
}

export function assertValidGroupId(groupId: string): void {
  if (!groupId || groupId.includes(":")) throw new InvalidGroupIdError();
}
