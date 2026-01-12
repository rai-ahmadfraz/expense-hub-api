import {
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  ValidateIf,
  ArrayNotEmpty,
  IsNumber,
  IsString
} from "class-validator";

export class CreateExpenseDto {
  @IsNotEmpty({ message: 'Name is required' })
  name: string;

  @IsNotEmpty({ message: 'Amount is required' })
  amount: number;

  @IsOptional()
  @IsNumber()
  paid_id: number;

  @IsOptional()
  @IsBoolean()
  is_personal: boolean;

  @IsOptional()
  type: string;

  @IsOptional()
  currency: string;

  @IsOptional()
  @ValidateIf(o => o.is_personal === false)
  @ArrayNotEmpty({ message: 'Participants are required when expense is not personal' })
  participants: {
    id: number;
    share_type: 'equal' | 'percentage' | 'fixed';
    share_value?: number;
  }[];
}
