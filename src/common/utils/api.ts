import { GeoLocationData } from '../types/api'
import { GET } from './axios'

/**
 * Determines the geo location of a requestor.
 *
 * @returns An object that contains the country of the requestor.
 */
const getGeoLocation = async () => {
  const api = 'https://api.country.is'

  try {
    const response = await GET<GeoLocationData>(api)

    return { country: response.data.data.country, error: false }
  } catch (error) {
    return { country: undefined, error: true }
  }
}
