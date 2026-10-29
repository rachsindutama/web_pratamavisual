import { useEffect } from 'react';
import { motion } from 'framer-motion';
import BookingForm from '../components/ui/BookingForm';
import { useSiteSettings } from '../hooks/useSiteSettings';
import '../styles/booking.css';

export default function Booking() {
  const { settings } = useSiteSettings();

  useEffect(() => {
    if (settings) {
      document.title = settings.seoTitle || settings.brandName || '';
    }
  }, [settings]);

  return (
    <div className="booking-page" id="booking-page">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="booking-page__title">
            Book Your Session
          </h1>
          <p className="booking-page__subtitle">
            Fill out the form below to secure your date and package. We can't wait to work with you.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <BookingForm />
        </motion.div>
      </div>
    </div>
  );
}
