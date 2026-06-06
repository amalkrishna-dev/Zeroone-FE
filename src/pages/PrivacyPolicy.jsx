import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaShieldAlt } from 'react-icons/fa';

const EFFECTIVE_DATE = 'May 13, 2026';
const COMPANY = 'Encrypt Bytes Labs';
const PRODUCT = 'Zero One';
const SUPPORT_EMAIL = 'privacy@Zero One.in';
const GRIEVANCE_EMAIL = 'grievance@Zero One.in';

function Section({ id, title, children }) {
  return (
    <section id={id} className="mb-9 scroll-mt-24">
      <h2 className="font-display text-xl sm:text-2xl font-bold text-ink-900 mb-3 tracking-tight">
        {title}
      </h2>
      <div className="text-sm sm:text-[15px] text-ink-700 leading-relaxed space-y-3">
        {children}
      </div>
    </section>
  );
}

function Bullets({ items }) {
  return (
    <ul className="space-y-2 pl-1">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-teal-500 flex-shrink-0" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

function KV({ rows }) {
  return (
    <div className="bg-ink-50 border border-ink-100 rounded-xl overflow-hidden">
      {rows.map(([k, v], i) => (
        <div
          key={i}
          className={`flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 px-4 py-3 text-sm ${i + 1 < rows.length ? 'border-b border-ink-100' : ''
            }`}
        >
          <span className="font-semibold text-ink-900 sm:w-56 flex-shrink-0">{k}</span>
          <span className="text-ink-600">{v}</span>
        </div>
      ))}
    </div>
  );
}

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-canvas">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur border-b border-ink-100 sticky top-0 z-40">
        <div className="page-container h-14 sm:h-16 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-ink-600 hover:text-ink-900 transition">
            <FaArrowLeft size={12} />
            <span className="text-sm font-medium">Back</span>
          </button>
          <Link to="/" className="wordmark text-base sm:text-lg">
            Zero One<span className="wordmark-dot">.</span>
          </Link>
          <div className="w-12" />
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-b from-teal-50 to-canvas border-b border-ink-100">
        <div className="page-container py-10 sm:py-14">
          <div className="inline-flex items-center gap-2 bg-white/80 border border-teal-100 rounded-full px-3 py-1 mb-4">
            <FaShieldAlt size={11} className="text-teal-600" />
            <span className="text-2xs font-semibold text-teal-700 tracking-[0.14em] uppercase">Privacy Policy</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-ink-900 tracking-tight mb-3">
            How we handle your data.
          </h1>
          <p className="text-ink-500 text-sm sm:text-base max-w-2xl">
            Effective <span className="font-medium text-ink-700">{EFFECTIVE_DATE}</span>. This policy explains what
            personal information {PRODUCT} collects, why we collect it (including Aadhaar-linked data used for KYC),
            how long we keep it, and how you can exercise your rights under the Digital Personal Data Protection
            Act, 2023 (DPDP Act).
          </p>
        </div>
      </section>

      {/* Body */}
      <main className="page-container py-10 sm:py-14 max-w-3xl">
        {/* Table of contents */}
        <nav className="mb-10 bg-white border border-ink-100 rounded-xl p-5">
          <h3 className="text-2xs font-semibold text-ink-500 tracking-[0.14em] uppercase mb-3">On this page</h3>
          <ol className="text-sm text-teal-700 space-y-1.5">
            <li><a href="#who" className="hover:underline">1. Who we are</a></li>
            <li><a href="#what" className="hover:underline">2. What personal data we collect</a></li>
            <li><a href="#aadhaar" className="hover:underline">3. Aadhaar &amp; KYC data - purpose and lawful basis</a></li>
            <li><a href="#how-use" className="hover:underline">4. How we use your data</a></li>
            <li><a href="#sharing" className="hover:underline">5. Who we share data with</a></li>
            <li><a href="#retention" className="hover:underline">6. Data retention policy</a></li>
            <li><a href="#security" className="hover:underline">7. How we protect your data</a></li>
            <li><a href="#rights" className="hover:underline">8. Your rights as a data principal</a></li>
            <li><a href="#cookies" className="hover:underline">9. Cookies &amp; analytics</a></li>
            <li><a href="#children" className="hover:underline">10. Children</a></li>
            <li><a href="#changes" className="hover:underline">11. Changes to this policy</a></li>
            <li><a href="#contact" className="hover:underline">12. Contact &amp; grievance officer</a></li>
          </ol>
        </nav>

        <Section id="who" title="1. Who we are">
          <p>
            {PRODUCT} is a hotel and serviced-stay booking platform operated by {COMPANY} (referred to as
            “{PRODUCT}”, “we”, “us”, or “our”). We are the data fiduciary for the personal data of guests, property
            owners and staff who use our services.
          </p>
          <p>
            Our registered address and grievance officer contact details are listed in section&nbsp;12.
          </p>
        </Section>

        <Section id="what" title="2. What personal data we collect">
          <p>We collect the following categories of personal data only to the extent necessary to provide our service:</p>
          <Bullets
            items={[
              <><b>Account data</b> - full name, Indian mobile number, and email address. Email is required so we can send booking confirmations, room-access details and password-reset codes. We authenticate logins with a password, stored only as a salted bcrypt hash - never in plain text.</>,
              <><b>Profile data</b> - date of birth, gender, address, nationality (collected at the time of your first booking; optional until then).</>,
              <><b>Aadhaar-linked KYC data</b> - see section&nbsp;3 below.</>,
              <><b>Booking and stay data</b> - check-in / check-out dates, room and property selected, special requests, co-guest details, payment method.</>,
              <><b>Payment data</b> - we use Razorpay as our payment processor. Card and UPI details are submitted directly to Razorpay and are <i>not</i> stored on our servers. We only retain transaction identifiers and amounts.</>,
              <><b>Communication logs</b> - records of email messages we send you (delivery status, timestamps).</>,
              <><b>Device and usage data</b> - IP address, browser/device user agent, and pages visited, for security and abuse-prevention purposes.</>,
            ]}
          />
        </Section>

        <Section id="aadhaar" title="3. Aadhaar & KYC data - purpose and lawful basis">
          <div className="bg-teal-50 border border-teal-100 rounded-xl p-4 sm:p-5 mb-4">
            <p className="text-teal-900 font-medium">
              Aadhaar verification is required only when you make your first booking. You can browse properties and
              create an account without sharing Aadhaar information.
            </p>
          </div>

          <p>
            When you complete a Know-Your-Customer (KYC) check on {PRODUCT}, we collect the following Aadhaar-linked
            data from you or from your DigiLocker / Aadhaar offline XML, with your explicit consent at the time of
            collection:
          </p>
          <Bullets
            items={[
              'Your 12-digit Aadhaar number (stored masked, with only the last 4 digits visible to staff who have KYC permission).',
              'Your name, date of birth, gender and address as printed on your Aadhaar.',
              'A scan or photograph of your Aadhaar card (front and back) for visual verification.',
              'A live selfie captured at the time of verification, used to confirm that the person submitting the document is the same as the person on the Aadhaar card (face match).',
            ]}
          />

          <p className="mt-3"><b>Why we collect this data:</b></p>
          <Bullets
            items={[
              'To verify your identity before you can occupy a room, as required by hospitality regulations in India and by individual state / local police directives applicable to hotels and homestays.',
              'To maintain the guest register and (where applicable) to file Form-C for foreign nationals with the FRRO (Foreigners Regional Registration Office) under the Registration of Foreigners Act, 1939.',
              'To prevent fraud, identity theft and unauthorised bookings, and to comply with the Prevention of Money-Laundering Act (PMLA) where applicable.',
              'To comply with directions from law enforcement agencies acting under lawful authority.',
            ]}
          />

          <p className="mt-3"><b>Lawful basis:</b></p>
          <Bullets
            items={[
              'Your explicit consent at the time of KYC submission (Section 6, DPDP Act, 2023).',
              'Compliance with legal obligation under the Registration of Foreigners Act, 1939; Aadhaar (Targeted Delivery of Financial and Other Subsidies, Benefits and Services) Act, 2016 - particularly Section 8 for offline verification; and applicable state hospitality rules.',
            ]}
          />

          <p className="mt-3">
            We <b>do not</b> use Aadhaar data for any purpose other than identity verification, regulatory compliance,
            and fraud prevention. We <b>do not</b> sell Aadhaar data, share it with advertisers, or use it for
            profiling. The Aadhaar number itself is never shown to property owners or staff in full - they only see
            a masked form (e.g. <code className="text-xs bg-ink-100 px-1.5 py-0.5 rounded">XXXX-XXXX-1234</code>) and
            the verification status.
          </p>
        </Section>

        <Section id="how-use" title="4. How we use your data">
          <Bullets
            items={[
              'Create and authenticate your account (password login and email-based password recovery).',
              'Process bookings and payments, and send you booking confirmations, smart-lock PINs and check-in details.',
              'Verify your identity for stay regulations (see section 3).',
              'Provide customer support, including responding to refund and dispute requests.',
              'Send service-related notifications (booking reminders, KYC reminders, checkout reminders, review requests).',
              'Detect and prevent fraud, abuse, and security incidents.',
              'Meet legal, tax, accounting and regulatory obligations.',
            ]}
          />
          <p>
            We do not use your personal data to train third-party AI models, and we do not sell your personal data
            to anyone.
          </p>
        </Section>

        <Section id="sharing" title="5. Who we share data with">
          <Bullets
            items={[
              <><b>Property owners and authorised staff</b> who host your booking - they receive your name, contact details, booking dates, special requests, co-guest list and KYC status (verified / pending). They do <i>not</i> see your full Aadhaar number, Aadhaar image, or selfie.</>,
              <><b>KYC service providers</b> (such as HyperVerge for OCR and face match, or Setu / DigiLocker for Aadhaar-based verification) - they process Aadhaar data on our behalf under signed data-processing agreements.</>,
              <><b>Payment processors</b> (Razorpay) - to charge and refund you.</>,
              <><b>Communication providers</b> (transactional email provider) - to deliver account, booking-related and password-recovery messages.</>,
              <><b>Law enforcement and regulatory authorities</b> - when we are required to do so under a lawful written request, court order, or statutory obligation (e.g. FRRO Form-C for foreign nationals; guest register inspection).</>,
              <><b>Professional advisers</b> (auditors, lawyers) - under strict confidentiality, only as needed.</>,
            ]}
          />
        </Section>

        <Section id="retention" title="6. Data retention policy">
          <p>We do not keep your personal data for longer than we need to. Specific retention periods are:</p>
          <KV
            rows={[
              ['Aadhaar number (masked)', '7 years after your last booking, to satisfy tax-record retention and police inspection obligations; deleted automatically after that.'],
              ['Aadhaar image (front/back)', '180 days after the related booking checkout, OR until your KYC profile is re-verified - whichever is earlier. The image itself is deleted from our object storage; only the verification status and the masked number remain.'],
              ['Live selfie used for face match', '90 days after the face-match decision; deleted automatically.'],
              ['Booking and payment records', '8 years from the date of the transaction, to comply with the Income Tax Act and the Companies Act audit-trail requirements.'],
              ['Communication logs (email)', '24 months from the date of the message.'],
              ['Account profile (name, phone, email, address)', 'As long as your account is active. If you request deletion, we erase your profile within 30 days, subject to the booking and payment retention above.'],
              ['Device / IP logs', '90 days, used only for security and abuse investigation.'],
              ['Guest register (for properties)', 'Retained for the period required by the local state hospitality / police directive (typically 12 months), then deleted.'],
            ]}
          />
          <p className="mt-3">
            Where the law obliges us to keep certain records for longer (for example tax records, or a pending legal
            dispute), we will keep them only for the period required and then delete them.
          </p>
        </Section>

        <Section id="security" title="7. How we protect your data">
          <Bullets
            items={[
              'All data is stored in India (AWS Mumbai region) so that it stays within Indian jurisdiction in line with the DPDP Act.',
              'Aadhaar images, selfies and other sensitive files are encrypted at rest using AES-256 and in transit over TLS 1.2+.',
              'Aadhaar numbers are stored masked at the application layer; the unmasked form is only accessed by a limited subset of background services that perform regulatory reporting.',
              'Access to KYC records is gated by per-employee permissions; every read or override of a KYC record is logged and visible to the organisation owner.',
              'We run regular security reviews of our code and infrastructure, and use bcrypt for any password hashing.',
            ]}
          />
          <p>
            No method of transmission over the internet is 100% secure. If we ever become aware of a personal data
            breach that is likely to result in significant harm to you, we will notify both you and the Data
            Protection Board of India as required by the DPDP Act.
          </p>
        </Section>

        <Section id="rights" title="8. Your rights as a data principal">
          <p>Under the DPDP Act, 2023 you have the right to:</p>
          <Bullets
            items={[
              'Access a summary of the personal data we hold about you and the processing activities we carry out.',
              'Correct, complete, update or erase your personal data.',
              'Withdraw a consent you previously gave us - including consent for Aadhaar KYC. Note: withdrawing KYC consent will stop you from making new bookings, but does not affect bookings already completed.',
              'Nominate another individual to exercise these rights on your behalf in the event of your death or incapacity.',
              'Lodge a grievance with our grievance officer (see section 12) and, if unresolved, escalate to the Data Protection Board of India.',
            ]}
          />
          <p>
            To exercise any of these rights, write to{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-teal-700 hover:underline">{SUPPORT_EMAIL}</a> from
            the email or mobile number on your account. We will respond within 30 days.
          </p>
        </Section>

        <Section id="cookies" title="9. Cookies & analytics">
          <p>
            We use a small number of strictly-necessary cookies (and equivalent local-storage entries) to keep you
            signed in and to remember your booking selection. We do <i>not</i> use third-party advertising cookies
            or cross-site tracking pixels.
          </p>
        </Section>

        <Section id="children" title="10. Children">
          <p>
            {PRODUCT} is not intended for users under 18. Children may stay as accompanied co-guests on a booking
            made by an adult; in such cases we collect only the child’s name and age, as needed for the guest
            register, and only from a verified adult guest who has parental authority.
          </p>
        </Section>

        <Section id="changes" title="11. Changes to this policy">
          <p>
            We may update this policy as our service or the law evolves. When we make a material change, we will
            notify you at the email address or mobile number on your account at least 7 days before the new policy
            takes effect. The “Effective” date at the top of this page always shows the current version.
          </p>
        </Section>

        <Section id="contact" title="12. Contact & grievance officer">
          <KV
            rows={[
              ['Operator', `${COMPANY} (operator of ${PRODUCT})`],
              ['Privacy queries', <a href={`mailto:${SUPPORT_EMAIL}`} className="text-teal-700 hover:underline">{SUPPORT_EMAIL}</a>],
              ['Grievance officer', <a href={`mailto:${GRIEVANCE_EMAIL}`} className="text-teal-700 hover:underline">{GRIEVANCE_EMAIL}</a>],
              ['Postal correspondence', `${COMPANY}, India. Send to the email above and we will share our current postal address.`],
              ['Response time', 'Acknowledgement within 72 hours. Substantive response within 30 days.'],
            ]}
          />
        </Section>

        <div className="mt-12 pt-6 border-t border-ink-100 text-xs text-ink-400 leading-relaxed">
          This policy is provided in English. In the event of a conflict between this English version and any
          translation, the English version governs. This policy is not legal advice; if you need legal advice
          about Indian data-protection law, please consult a qualified advocate.
        </div>
      </main>
    </div>
  );
}
