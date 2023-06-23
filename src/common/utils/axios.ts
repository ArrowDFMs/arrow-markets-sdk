import type { AxiosRequestConfig, AxiosResponse } from 'axios'
import Axios from 'axios'

const axios = Axios.create()

export const GET = <T>(
  url: any,
  config?: AxiosRequestConfig
): Promise<AxiosResponse<T>> => axios.get<T>(url, config)

export const POST = <T, U>(
  url: any,
  data?: T,
  config?: AxiosRequestConfig
): Promise<AxiosResponse<U>> => axios.post<U>(url, data, config)
