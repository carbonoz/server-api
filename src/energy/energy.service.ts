import { Injectable } from '@nestjs/common';
import { TotalEnergy, User } from '@prisma/client';
import { endOfDay, parseISO, startOfDay, subDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { PrismaService } from 'src/prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class EnergyService {
  constructor(private prismaService: PrismaService) {}

  private async adjustTotals(result: TotalEnergy[]): Promise<TotalEnergy[]> {
    result.sort(
      (a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime(),
    );

    const updatedResult: TotalEnergy[] = [];

    for (let i = 0; i < result.length; i++) {
      const todayData = result[i];
      const yesterdayData = result[i + 1] || {
        pvPower: '0',
        loadPower: '0',
        gridIn: '0',
        gridOut: '0',
        batteryCharged: '0',
        batteryDischarged: '0',
        date: '',
        topic: null,
        port: null,
        userId: '',
      };

      const todayDate = parseISO(todayData.date);
      const yesterdayDate = parseISO(yesterdayData.date);

      if (todayDate > yesterdayDate) {
        const getDifference = (today: string, yesterday: string) =>
          (parseFloat(today) - parseFloat(yesterday)).toFixed(2);

        updatedResult.push({
          ...todayData,
          pvPower: getDifference(todayData.pvPower, yesterdayData.pvPower),
          loadPower: getDifference(
            todayData.loadPower,
            yesterdayData.loadPower,
          ),
          gridIn: getDifference(todayData.gridIn, yesterdayData.gridIn),
          gridOut: getDifference(todayData.gridOut, yesterdayData.gridOut),
          batteryCharged: getDifference(
            todayData.batteryCharged,
            yesterdayData.batteryCharged,
          ),
          batteryDischarged: getDifference(
            todayData.batteryDischarged,
            yesterdayData.batteryDischarged,
          ),
        });
      } else {
        updatedResult.push(todayData);
      }
    }

    return updatedResult;
  }

  private adjustTotalsWithYesterdayData(
    totalForDate: TotalEnergy,
    yesterdayTotals: TotalEnergy,
  ): TotalEnergy {
    const adjustedTotals: TotalEnergy = {
      ...totalForDate,
      pvPower: this.calculateDifferenceOrRetain(
        parseFloat(totalForDate.pvPower),
        parseFloat(yesterdayTotals.pvPower),
      ),
      loadPower: this.calculateDifferenceOrRetain(
        parseFloat(totalForDate.loadPower),
        parseFloat(yesterdayTotals.loadPower),
      ),
      gridIn: this.calculateDifferenceOrRetain(
        parseFloat(totalForDate.gridIn),
        parseFloat(yesterdayTotals.gridIn),
      ),
      gridOut: this.calculateDifferenceOrRetain(
        parseFloat(totalForDate.gridOut),
        parseFloat(yesterdayTotals.gridOut),
      ),
      batteryCharged: this.calculateDifferenceOrRetain(
        parseFloat(totalForDate.batteryCharged),
        parseFloat(yesterdayTotals.batteryCharged),
      ),
      batteryDischarged: this.calculateDifferenceOrRetain(
        parseFloat(totalForDate.batteryDischarged),
        parseFloat(yesterdayTotals.batteryDischarged),
      ),
    };
    return adjustedTotals;
  }

  private calculateDifferenceOrRetain(
    todayValue: number,
    yesterdayValue: number,
  ): string {
    return (
      todayValue > yesterdayValue ? todayValue - yesterdayValue : todayValue
    ).toFixed(2);
  }

  private isZeroTotal(total: TotalEnergy): boolean {
    return Object.values(total).every((value) => value === '0');
  }

  private async getTotalsForDateRange(
    user: User,
    days: number,
    isYearly = false,
  ): Promise<Array<TotalEnergy>> {
    const userPorts = await this.prismaService.userPorts.findFirst({
      where: { userId: user.id },
    });

    const today = new Date();
    const startDate = isYearly
      ? subDays(today, days * 365)
      : subDays(today, days - 1);
    const timezone = 'Indian/Mauritius';

    const totals = await this.prismaService.totalEnergy.findMany({
      where: {
        AND: [
          { OR: [{ userId: user.id }, { port: userPorts?.port }] },
          {
            date: {
              gte: formatInTimeZone(
                startOfDay(startDate),
                timezone,
                "yyyy-MM-dd'T'HH:mm:ssXXX",
              ),
              lte: formatInTimeZone(
                endOfDay(today),
                timezone,
                "yyyy-MM-dd'T'HH:mm:ssXXX",
              ),
            },
          },
        ],
      },
    });

    const result: Array<TotalEnergy> = [];
    for (let i = 0; i < days; i++) {
      const currentDate = subDays(today, i);
      const formattedDate = formatInTimeZone(
        startOfDay(currentDate),
        timezone,
        'yyyy-MM-dd',
      );

      let totalForDate = totals.find(
        (t) =>
          formatInTimeZone(parseISO(t.date), timezone, 'yyyy-MM-dd') ===
            formattedDate && !this.isZeroTotal(t),
      );

      const previousDate = isYearly
        ? subDays(currentDate, 365)
        : subDays(currentDate, 1);
      const yesterdayTotals = totals.find(
        (t) =>
          formatInTimeZone(parseISO(t.date), timezone, 'yyyy-MM-dd') ===
          formatInTimeZone(previousDate, timezone, 'yyyy-MM-dd'),
      );

      if (totalForDate && yesterdayTotals) {
        totalForDate = this.adjustTotalsWithYesterdayData(
          totalForDate,
          yesterdayTotals,
        );
      }

      if (totalForDate) {
        result.push(totalForDate);
      } else {
        result.push({
          id: uuidv4(),
          pvPower: '0',
          loadPower: '0',
          gridIn: '0',
          gridOut: '0',
          batteryCharged: '0',
          batteryDischarged: '0',
          date: formatInTimeZone(
            startOfDay(currentDate),
            timezone,
            "yyyy-MM-dd'T'HH:mm:ssXXX",
          ),
          topic: null,
          port: userPorts?.port || '',
          userId: user.id,
        });
      }
    }

    return this.adjustTotals(result.reverse());
  }

  async getTotalsEnergy(user: User): Promise<Array<TotalEnergy>> {
    return this.getTotalsForDateRange(user, 7);
  }

  async getTotalsEnergyLast30Days(user: User): Promise<Array<TotalEnergy>> {
    return this.getTotalsForDateRange(user, 30);
  }

  async getTotalsEnergyLast12Months(user: User): Promise<Array<TotalEnergy>> {
    return this.getTotalsForDateRange(user, 12, true);
  }

  async getTotalsEnergyLast10Years(user: User): Promise<Array<TotalEnergy>> {
    return this.getTotalsForDateRange(user, 10, true);
  }
}
