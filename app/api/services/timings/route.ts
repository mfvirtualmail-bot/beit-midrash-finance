import { NextRequest, NextResponse } from 'next/server'
import { HDate } from '@hebcal/core'

// Coordinates for Antwerp, Belgium
const ANTWERP_LAT = 51.2194
const ANTWERP_LON = 4.4025

// Calculate sunset time using simple approximation
// For accurate results, consider using an external API like timeanddate.com or sunrisesunset.org
function calculateSunset(date: Date): Date {
  // This is a simplified calculation. For production, use a real ephemeris library or API
  // Using a basic algorithm that approximates sunset time in Antwerp

  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000)

  // Approximate sunset times for Antwerp throughout the year
  // These are rough estimates; for accuracy use an external service
  let sunsetHours = 17.0

  if (dayOfYear < 80) sunsetHours = 17.0 + (dayOfYear / 80) * 1.5
  else if (dayOfYear < 172) sunsetHours = 18.5 + ((dayOfYear - 80) / 92) * 2.5
  else if (dayOfYear < 264) sunsetHours = 21.0 - ((dayOfYear - 172) / 92) * 2.5
  else if (dayOfYear < 355) sunsetHours = 18.5 - ((dayOfYear - 264) / 91) * 1.5
  else sunsetHours = 17.0 + ((dayOfYear - 355) / 10) * 0.2

  const sunsetDate = new Date(date)
  sunsetDate.setHours(Math.floor(sunsetHours), Math.round((sunsetHours % 1) * 60), 0, 0)
  return sunsetDate
}

// Round time to nearest 5 minutes
function roundToNearestFive(date: Date): Date {
  const minutes = date.getMinutes()
  const rounded = Math.round(minutes / 5) * 5
  const newDate = new Date(date)
  newDate.setMinutes(rounded)
  return newDate
}

// Add/subtract minutes from a date
function addMinutes(date: Date, minutes: number): Date {
  const newDate = new Date(date)
  newDate.setMinutes(newDate.getMinutes() + minutes)
  return newDate
}

// Format time as HH:MM
function formatTime(date: Date): string {
  return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export async function GET(req: NextRequest) {
  try {
    const year = req.nextUrl.searchParams.get('year') || new Date().getFullYear().toString()
    const yearNum = parseInt(year, 10)

    // Define prayer services with their offsets from sunset (in minutes)
    const services = [
      { id: 'mincha', name_he: 'מנחה', name_en: 'Mincha', offsetMinutes: -60 },
      { id: 'shacharit', name_he: 'שחרית', name_en: 'Shacharit', offsetMinutes: 15 },
      { id: 'maariv', name_he: 'מעריב', name_en: 'Maariv', offsetMinutes: 45 },
      { id: 'kiddush', name_he: 'קידוש', name_en: 'Kiddush', offsetMinutes: 50 },
    ]

    // Generate timings for the entire year
    const timings = []
    const startDate = new Date(yearNum, 0, 1)
    const endDate = new Date(yearNum, 11, 31)

    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      const sunset = calculateSunset(new Date(date))
      const hdate = new HDate(new Date(date))

      const dayTimings: any = {
        date: date.toISOString().split('T')[0],
        hebrewDate: hdate.toString(),
        sunset: formatTime(sunset),
        services: {},
      }

      // Calculate time for each service
      for (const service of services) {
        const serviceTime = addMinutes(sunset, service.offsetMinutes)
        const roundedTime = roundToNearestFive(serviceTime)
        dayTimings.services[service.id] = formatTime(roundedTime)
      }

      timings.push(dayTimings)
    }

    return NextResponse.json({
      year: yearNum,
      location: { name: 'Antwerp, Belgium', lat: ANTWERP_LAT, lon: ANTWERP_LON },
      services,
      timings,
    })
  } catch (e) {
    console.error('Error calculating timings:', e)
    return NextResponse.json({ error: 'Failed to calculate timings' }, { status: 500 })
  }
}
