import { Injectable } from '@nestjs/common'
import nodemailer from 'nodemailer'
import type { OutboundEmail } from '../domain/message'
import { Config } from './config'

@Injectable()
export class SmtpMailer {
  private readonly transport: nodemailer.Transporter

  constructor(private readonly config: Config) {
    this.transport = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: false,
    })
  }

  send(message: OutboundEmail): Promise<unknown> {
    return this.transport.sendMail({
      from: this.config.smtpFrom,
      to: message.to,
      subject: message.subject,
      text: message.text,
    })
  }
}
