export class MemberBranchEntity {
  memberId: number;
  branchId: number;
  createdAt: Date;

  constructor(data: Partial<MemberBranchEntity>) {
    this.memberId = data.memberId!;
    this.branchId = data.branchId!;
    this.createdAt = data.createdAt ?? new Date();
  }
}
