import { Injectable } from '@nestjs/common';
import { TotalEnergy, User } from '@prisma/client';
import { createObjectCsvStringifier } from 'csv-writer';
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
import { FilterEnergyForLastMonthsDTO, FilterTimeEnergyDTO } from './dto';

interface DailyEntry {
  date: string;
  pvPower: string;
  loadPower: string;
  gridIn: string;
  gridOut: string;
  batteryCharged: string;
  batteryDischarged: string;
}

interface MonthlyEntry {
  id: string;
  date: string;
  pvPower: number;
  loadPower: number;
  gridIn: number;
  gridOut: number;
  batteryCharged: number;
  batteryDischarged: number;
  userId: string;
}

@Injectable()
export class EnergyService {
  constructor(private prismaService: PrismaService) {}

  /**
   * Helper function to calculate the difference between two string numeric values.
   * If the difference is negative, returns the current value.
   */

  private calculateDifference(current: string, previous: string): string {
    const difference = (parseFloat(current) - parseFloat(previous)).toFixed(2);
    return parseFloat(difference) > 0 ? difference : current;
  }

  private async adjustTotals(result: TotalEnergy[]): Promise<TotalEnergy[]> {
    result.sort(
      (a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime(),
    );

    const updatedResult: TotalEnergy[] = [];

    for (let i = 0; i < result.length; i++) {
      const todayData = result[i];

      if (todayData.mqttTopicPrefix !== 'solar_assistant_DEYE') {
        updatedResult.push(todayData);
        continue;
      }

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
        mqttTopicPrefix: '',
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

  private async adjustMonthlyTotals(
    result: TotalEnergy[],
  ): Promise<Array<DailyEntry>> {
    result.sort(
      (a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime(),
    );

    const lastValuesMap = new Map<string, TotalEnergy>();
    for (const entry of result) {
      lastValuesMap.set(entry.date, entry);
    }

    const updatedResult: Array<{
      date: string;
      pvPower: string;
      loadPower: string;
      gridIn: string;
      gridOut: string;
      batteryCharged: string;
      batteryDischarged: string;
    }> = [];

    const dates = Array.from(lastValuesMap.keys());
    for (let i = 0; i < dates.length; i++) {
      const todayDate = dates[i];
      const todayData = lastValuesMap.get(todayDate);
      const yesterdayData = lastValuesMap.get(dates[i - 1]);

      // If mqttTopicPrefix is not solar_assistant_DEYE, push data as is
      if (todayData.mqttTopicPrefix !== 'solar_assistant_DEYE') {
        updatedResult.push({
          date: todayDate,
          pvPower: todayData.pvPower,
          loadPower: todayData.loadPower,
          gridIn: todayData.gridIn,
          gridOut: todayData.gridOut,
          batteryCharged: todayData.batteryCharged,
          batteryDischarged: todayData.batteryDischarged,
        });
        continue;
      }

      // Calculate differences only for solar_assistant_DEYE entries
      if (
        yesterdayData &&
        yesterdayData.mqttTopicPrefix === 'solar_assistant_DEYE'
      ) {
        updatedResult.push({
          date: todayDate,
          pvPower: this.calculateDifference(
            todayData.pvPower,
            yesterdayData.pvPower,
          ),
          loadPower: this.calculateDifference(
            todayData.loadPower,
            yesterdayData.loadPower,
          ),
          gridIn: this.calculateDifference(
            todayData.gridIn,
            yesterdayData.gridIn,
          ),
          gridOut: this.calculateDifference(
            todayData.gridOut,
            yesterdayData.gridOut,
          ),
          batteryCharged: this.calculateDifference(
            todayData.batteryCharged,
            yesterdayData.batteryCharged,
          ),
          batteryDischarged: this.calculateDifference(
            todayData.batteryDischarged,
            yesterdayData.batteryDischarged,
          ),
        });
      } else {
        updatedResult.push({
          date: todayDate,
          pvPower: todayData.pvPower,
          loadPower: todayData.loadPower,
          gridIn: todayData.gridIn,
          gridOut: todayData.gridOut,
          batteryCharged: todayData.batteryCharged,
          batteryDischarged: todayData.batteryDischarged,
        });
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
    dto?: FilterTimeEnergyDTO,
  ): Promise<Array<TotalEnergy>> {
    const userPorts = await this.prismaService.userPorts.findFirst({
      where: { userId: user.id },
    });

    const information = await this.prismaService.userInformation.findFirst({
      where: { userId: user.id },
    });

    const defaultTimezone = information?.customerTimezone;

    const timezone = dto?.timezone ? dto?.timezone : defaultTimezone;
    const today = new Date();
    const startDate = dto?.from
      ? parseISO(formatInTimeZone(new Date(dto.from), timezone, 'yyyy-MM-dd'))
      : subDays(today, days - 1);

    const endDate = dto?.to
      ? parseISO(formatInTimeZone(new Date(dto.to), timezone, 'yyyy-MM-dd'))
      : today;

    const totals = await this.prismaService.totalEnergy.findMany({
      where: {
        AND: [
          { OR: [{ userId: user.id }, { port: userPorts?.port }] },
          {
            date: {
              gte: formatInTimeZone(
                startOfDay(new Date(startDate)),
                timezone,
                "yyyy-MM-dd'T'HH:mm:ssXXX",
              ),
              lte: formatInTimeZone(
                endOfDay(new Date(endDate)),
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

      const previousDate = subDays(currentDate, 1);
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
          mqttTopicPrefix: '',
          userId: user.id,
        });
      }
    }

    return this.adjustTotals(result.reverse());
  }

  async getTotalsEnergy(
    user: User,
    dto: FilterTimeEnergyDTO,
  ): Promise<Array<TotalEnergy>> {
    return this.getTotalsForDateRange(user, 7, dto);
  }

  async getTotalsEnergyLast30Days(
    user: User,
    dto: FilterTimeEnergyDTO,
  ): Promise<Array<TotalEnergy>> {
    return this.getTotalsForDateRange(user, 30, dto);
  }

  async getTotalsEnergyLast12Months(
    user: User,
    dto?: FilterEnergyForLastMonthsDTO,
  ) {
    const userPorts = await this.prismaService.userPorts.findFirst({
      where: { userId: user.id },
    });

    const today = new Date();
    const startDate = subMonths(today, 11);

    const timezone = dto?.timezone ? dto?.timezone : 'Indian/Mauritius';

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

    const result = await this.adjustMonthlyTotals(totals);

    const months = Array.from({ length: 12 }, (_, i) =>
      subMonths(today, 11 - i),
    );

    const monthlyData = result.reduce<Record<string, MonthlyEntry>>(
      (acc, entry) => {
        const month = format(parseISO(entry.date), 'yyyy-MM');

        if (!acc[month]) {
          acc[month] = {
            id: uuidv4(),
            date: `${month}-01T00:00:00Z`, // Set the first day of the month
            pvPower: 0,
            loadPower: 0,
            gridIn: 0,
            gridOut: 0,
            batteryCharged: 0,
            batteryDischarged: 0,
            userId: user.id,
          };
        }

        acc[month].pvPower += parseFloat(entry.pvPower);
        acc[month].loadPower += parseFloat(entry.loadPower);
        acc[month].gridIn += parseFloat(entry.gridIn);
        acc[month].gridOut += parseFloat(entry.gridOut);
        acc[month].batteryCharged += parseFloat(entry.batteryCharged);
        acc[month].batteryDischarged += parseFloat(entry.batteryDischarged);

        return acc;
      },
      {},
    );

    months.forEach((month) => {
      const formattedMonth = format(startOfMonth(month), 'yyyy-MM');
      if (!monthlyData[formattedMonth]) {
        monthlyData[formattedMonth] = {
          id: uuidv4(),
          date: `${formattedMonth}-01T00:00:00Z`,
          pvPower: 0,
          loadPower: 0,
          gridIn: 0,
          gridOut: 0,
          batteryCharged: 0,
          batteryDischarged: 0,
          userId: user.id,
        };
      }
    });

    const formattedMonthlyData = Object.values(monthlyData)
      .sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateB.getMonth() - dateA.getMonth(); // Sort by month (ascending)
      })
      .map((entry) => ({
        ...entry,
        pvPower: entry.pvPower.toFixed(2),
        loadPower: entry.loadPower.toFixed(2),
        gridIn: entry.gridIn.toFixed(2),
        gridOut: entry.gridOut.toFixed(2),
        batteryCharged: entry.batteryCharged.toFixed(2),
        batteryDischarged: entry.batteryDischarged.toFixed(2),
      }));

    return formattedMonthlyData;
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
        mqttTopicPrefix: '',
      }),
    );

    return result.reverse(); // Reverse to make the most recent year first
  }

  //CSV file downloads
  async generateCsvFileForLastSevenDays(user: User, dto: FilterTimeEnergyDTO) {
    const result = await this.getTotalsForDateRange(user, 7, dto);

    const csvHeaders = [
      { id: 'date', title: 'Date' },
      { id: 'pvPower', title: 'PV Power' },
      { id: 'loadPower', title: 'Load Power' },
      { id: 'gridIn', title: 'Grid In' },
      { id: 'gridOut', title: 'Grid Out' },
      { id: 'batteryCharged', title: 'Battery Charged' },
      { id: 'batteryDischarged', title: 'Battery Discharged' },
    ];

    const csvStringifier = createObjectCsvStringifier({
      header: csvHeaders,
    });

    const records = result.map((data) => ({
      date: format(data.date, 'yyyy-MM-dd'),
      pvPower: data.pvPower,
      loadPower: data.loadPower,
      gridIn: data.gridIn,
      gridOut: data.gridOut,
      batteryCharged: data.batteryCharged,
      batteryDischarged: data.batteryDischarged,
    }));

    const csvContent =
      csvStringifier.getHeaderString() +
      csvStringifier.stringifyRecords(records);

    return { file: csvContent, fileName: 'energy_data_last_7_days' };
  }

  async generateCsvFileForLast30Days(user: User, dto: FilterTimeEnergyDTO) {
    const result = await this.getTotalsForDateRange(user, 30, dto);
    const csvHeaders = [
      { id: 'date', title: 'Date' },
      { id: 'pvPower', title: 'PV Power' },
      { id: 'loadPower', title: 'Load Power' },
      { id: 'gridIn', title: 'Grid In' },
      { id: 'gridOut', title: 'Grid Out' },
      { id: 'batteryCharged', title: 'Battery Charged' },
      { id: 'batteryDischarged', title: 'Battery Discharged' },
    ];

    const csvStringifier = createObjectCsvStringifier({
      header: csvHeaders,
    });

    const records = result.map((data) => ({
      date: format(data.date, 'yyyy-MM-dd'),
      pvPower: data.pvPower,
      loadPower: data.loadPower,
      gridIn: data.gridIn,
      gridOut: data.gridOut,
      batteryCharged: data.batteryCharged,
      batteryDischarged: data.batteryDischarged,
    }));

    const csvContent =
      csvStringifier.getHeaderString() +
      csvStringifier.stringifyRecords(records);

    return { file: csvContent, fileName: 'energy_data_last_30_days' };
  }

  async generateCsvFileForLast12Months(
    user: User,
    dto?: FilterEnergyForLastMonthsDTO,
  ) {
    const result = await this.getTotalsEnergyLast12Months(user, dto);
    const csvHeaders = [
      { id: 'date', title: 'Date' },
      { id: 'pvPower', title: 'PV Power' },
      { id: 'loadPower', title: 'Load Power' },
      { id: 'gridIn', title: 'Grid In' },
      { id: 'gridOut', title: 'Grid Out' },
      { id: 'batteryCharged', title: 'Battery Charged' },
      { id: 'batteryDischarged', title: 'Battery Discharged' },
    ];

    const csvStringifier = createObjectCsvStringifier({
      header: csvHeaders,
    });

    const records = result.map((data) => ({
      date: format(data.date, 'yyyy-MM'),
      pvPower: data.pvPower,
      loadPower: data.loadPower,
      gridIn: data.gridIn,
      gridOut: data.gridOut,
      batteryCharged: data.batteryCharged,
      batteryDischarged: data.batteryDischarged,
    }));

    const csvContent =
      csvStringifier.getHeaderString() +
      csvStringifier.stringifyRecords(records);

    return { file: csvContent, fileName: 'energy_data_last_12_months' };
  }
}
