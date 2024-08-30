import { Injectable } from '@nestjs/common';
import { TotalEnergy, User } from '@prisma/client';
import {
  endOfDay,
  endOfMonth,
  endOfYear,
  format,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfYear,
  subDays,
  subMonths,
  subYears,
} from 'date-fns';
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
    const userPorts = await this.prismaService.userPorts.findFirst({
      where: { userId: user.id },
    });

    const today = new Date();
    const startDate = subMonths(today, 11); // 12 months including this month

    const timezone = 'Indian/Mauritius';

    const totals = await this.prismaService.totalEnergy.findMany({
      where: {
        AND: [
          { OR: [{ userId: user.id }, { port: userPorts?.port }] },
          {
            date: {
              gte: formatInTimeZone(
                startOfMonth(startDate),
                timezone,
                "yyyy-MM-dd'T'HH:mm:ssXXX",
              ),
              lte: formatInTimeZone(
                endOfMonth(today),
                timezone,
                "yyyy-MM-dd'T'HH:mm:ssXXX",
              ),
            },
          },
        ],
      },
    });

    const monthlyTotals: { [key: string]: TotalEnergy } = {};

    for (let i = 0; i < 12; i++) {
      const currentMonth = subMonths(today, 11 - i);
      const formattedMonth = format(startOfMonth(currentMonth), 'yyyy-MM');

      monthlyTotals[formattedMonth] = {
        id: uuidv4(), // Generate a unique ID
        pvPower: '0',
        loadPower: '0',
        gridIn: '0',
        gridOut: '0',
        batteryCharged: '0',
        batteryDischarged: '0',
        date: `${formattedMonth}-01T00:00:00Z`,
        topic: null,
        port: userPorts?.port || '',
        userId: user.id,
      };
    }

    totals.forEach((t) => {
      const totalDate = format(parseISO(t.date), 'yyyy-MM');
      if (monthlyTotals[totalDate]) {
        monthlyTotals[totalDate] = {
          ...monthlyTotals[totalDate],
          pvPower: (
            parseFloat(monthlyTotals[totalDate].pvPower) +
            parseFloat(t.pvPower || '0')
          ).toString(),
          loadPower: (
            parseFloat(monthlyTotals[totalDate].loadPower) +
            parseFloat(t.loadPower || '0')
          ).toString(),
          gridIn: (
            parseFloat(monthlyTotals[totalDate].gridIn) +
            parseFloat(t.gridIn || '0')
          ).toString(),
          gridOut: (
            parseFloat(monthlyTotals[totalDate].gridOut) +
            parseFloat(t.gridOut || '0')
          ).toString(),
          batteryCharged: (
            parseFloat(monthlyTotals[totalDate].batteryCharged) +
            parseFloat(t.batteryCharged || '0')
          ).toString(),
          batteryDischarged: (
            parseFloat(monthlyTotals[totalDate].batteryDischarged) +
            parseFloat(t.batteryDischarged || '0')
          ).toString(),
        };
      }
    });

    const result: Array<TotalEnergy> = Object.keys(monthlyTotals).map(
      (month) => ({
        ...monthlyTotals[month],
        id: uuidv4(), // Generate a unique ID
        date: `${month}-01T00:00:00Z`,
      }),
    );

    return result.reverse(); // Reverse to make the most recent month first
  }

  async getTotalsEnergyLast10Years(user: User): Promise<Array<TotalEnergy>> {
    const userPorts = await this.prismaService.userPorts.findFirst({
      where: {
        userId: user.id,
      },
    });

    const today = new Date();
    const startDate = subYears(today, 9); // 10 years including this year

    const timezone = 'Indian/Mauritius';

    const totals = await this.prismaService.totalEnergy.findMany({
      where: {
        AND: [
          { OR: [{ userId: user.id }, { port: userPorts?.port }] },
          {
            date: {
              gte: formatInTimeZone(
                startOfYear(startDate),
                timezone,
                "yyyy-MM-dd'T'HH:mm:ssXXX",
              ),
              lte: formatInTimeZone(
                endOfYear(today),
                timezone,
                "yyyy-MM-dd'T'HH:mm:ssXXX",
              ),
            },
          },
        ],
      },
    });

    const yearlyTotals: Record<
      string,
      {
        pvPower: number;
        loadPower: number;
        gridIn: number;
        gridOut: number;
        batteryCharged: number;
        batteryDischarged: number;
      }
    > = {};

    for (let i = 0; i < 10; i++) {
      const currentYear = subYears(today, 9 - i);
      const startOfYearDate = startOfYear(currentYear);
      const formattedYear = format(startOfYearDate, 'yyyy');

      yearlyTotals[formattedYear] = {
        pvPower: 0,
        loadPower: 0,
        gridIn: 0,
        gridOut: 0,
        batteryCharged: 0,
        batteryDischarged: 0,
      };

      totals.forEach((t) => {
        const totalYear = format(parseISO(t.date), 'yyyy');

        if (totalYear === formattedYear) {
          yearlyTotals[formattedYear].pvPower += parseFloat(t.pvPower || '0');
          yearlyTotals[formattedYear].loadPower += parseFloat(
            t.loadPower || '0',
          );
          yearlyTotals[formattedYear].gridIn += parseFloat(t.gridIn || '0');
          yearlyTotals[formattedYear].gridOut += parseFloat(t.gridOut || '0');
          yearlyTotals[formattedYear].batteryCharged += parseFloat(
            t.batteryCharged || '0',
          );
          yearlyTotals[formattedYear].batteryDischarged += parseFloat(
            t.batteryDischarged || '0',
          );
        }
      });
    }

    // Convert yearlyTotals to an array format
    const result: Array<TotalEnergy> = Object.keys(yearlyTotals).map(
      (year) => ({
        id: uuidv4(),
        pvPower: yearlyTotals[year].pvPower.toString(),
        loadPower: yearlyTotals[year].loadPower.toString(),
        gridIn: yearlyTotals[year].gridIn.toString(),
        gridOut: yearlyTotals[year].gridOut.toString(),
        batteryCharged: yearlyTotals[year].batteryCharged.toString(),
        batteryDischarged: yearlyTotals[year].batteryDischarged.toString(),
        date: `${year}-01-01T00:00:00Z`, // Use the start of the year
        topic: null,
        port: userPorts?.port || '',
        userId: user.id,
      }),
    );

    return result.reverse(); // Reverse to make the most recent year first
  }
}
