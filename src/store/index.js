import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  user: null,
  tokens: null,
  isAuthenticated: false,
  isInitializing: true,
  loading: false,

  setUser: (user) => set({ user }),
  setTokens: (tokens) => set({ tokens }),
  setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
  setInitializing: (isInitializing) => set({ isInitializing }),
  setLoading: (loading) => set({ loading }),

  login: (user, tokens) => set({
    user,
    tokens,
    isAuthenticated: true,
    isInitializing: false,
    loading: false,
  }),

  logout: () => set({
    user: null,
    tokens: null,
    isAuthenticated: false,
    isInitializing: false,
    loading: false,
  }),
}));

export const useBookingStore = create((set) => ({
  bookings: [],
  selectedBooking: null,
  loading: false,

  setBookings: (bookings) => set({ bookings }),
  setSelectedBooking: (booking) => set({ selectedBooking: booking }),
  setLoading: (loading) => set({ loading }),

  addBooking: (booking) => set((state) => ({
    bookings: [booking, ...state.bookings],
  })),
}));

export const usePropertyStore = create((set) => ({
  properties: [],
  selectedProperty: null,
  loading: false,

  setProperties: (properties) => set({ properties }),
  setSelectedProperty: (property) => set({ selectedProperty: property }),
  setLoading: (loading) => set({ loading }),
}));

export const useUIStore = create((set) => ({
  isMobileMenuOpen: false,
  isPropertyModalOpen: false,
  isBookingModalOpen: false,
  selectedDateRange: null,

  setMobileMenuOpen: (isOpen) => set({ isMobileMenuOpen: isOpen }),
  setPropertyModalOpen: (isOpen) => set({ isPropertyModalOpen: isOpen }),
  setBookingModalOpen: (isOpen) => set({ isBookingModalOpen: isOpen }),
  setSelectedDateRange: (range) => set({ selectedDateRange: range }),
}));
