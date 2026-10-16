import { IsEnum, IsInt, IsNotEmpty, IsNumber, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class PresenceOnlineDTO {
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;
}

export class PresencePingDTO extends PresenceOnlineDTO {}

export class AgentStatusDTO {
  @IsNotEmpty()
  @IsEnum(['picked', 'delivered'], {
    message: "status must be either 'picked' or 'delivered'",
  })
  status!: 'picked' | 'delivered';
}

export class AssignAgentDTO {
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  agentId!: number;
}
