import { useState } from 'react'
import { Icon } from '@iconify/react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { Header } from '../components/layout/Header'
import { useSettingsStore, DayHours, CommercialEvent, StoreHours } from '../stores/settingsStore'
import { settingsApi } from '../services/api'
import { DAYS_FR } from '../utils/planning'

const DAY_KEYS: (keyof StoreHours)[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

const EVENT_COLORS = [
  { name: 'Bleu', value: '#3B82F6' },
  { name: 'Rose', value: '#EC4899' },
  { name: 'Vert', value: '#10B981' },
  { name: 'Orange', value: '#F97316' },
  { name: 'Violet', value: '#8B5CF6' },
  { name: 'Teal', value: '#14B8A6' },
]

const EVENT_EMOJIS = ['🔥', '🏷️', '🎁', '🎄', '💝', '🌸', '☀️', '🎃']

export function Settings() {
  const { 
    storeHours, 
    updateDayHours, 
    events, 
    addEvent, 
    updateEvent, 
    deleteEvent 
  } = useSettingsStore()
  
  const [isLoading, setIsLoading] = useState(false)
  const [showEventForm, setShowEventForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CommercialEvent | null>(null)
  
  // Event form state
  const [eventName, setEventName] = useState('')
  const [eventEmoji, setEventEmoji] = useState('🔥')
  const [eventStartDate, setEventStartDate] = useState('')
  const [eventEndDate, setEventEndDate] = useState('')
  const [eventColor, setEventColor] = useState(EVENT_COLORS[0].value)
  
  const handleDayToggle = (dayKey: keyof StoreHours) => {
    const current = storeHours[dayKey]
    updateDayHours(dayKey, { ...current, isOpen: !current.isOpen })
  }
  
  const handleTimeChange = (dayKey: keyof StoreHours, field: 'openTime' | 'closeTime', value: string) => {
    const current = storeHours[dayKey]
    updateDayHours(dayKey, { ...current, [field]: value })
  }
  
  const handleSaveHours = async () => {
    setIsLoading(true)
    try {
      await settingsApi.updateStoreHours(storeHours)
      toast.success('Horaires enregistrés')
    } catch (error) {
      toast.error('Erreur lors de l\'enregistrement')
    } finally {
      setIsLoading(false)
    }
  }
  
  const resetEventForm = () => {
    setEventName('')
    setEventEmoji('🔥')
    setEventStartDate('')
    setEventEndDate('')
    setEventColor(EVENT_COLORS[0].value)
    setEditingEvent(null)
    setShowEventForm(false)
  }
  
  const handleEditEvent = (event: CommercialEvent) => {
    setEditingEvent(event)
    setEventName(event.name)
    setEventEmoji(event.emoji)
    setEventStartDate(event.startDate)
    setEventEndDate(event.endDate)
    setEventColor(event.color)
    setShowEventForm(true)
  }
  
  const handleSaveEvent = async () => {
    if (!eventName || !eventStartDate || !eventEndDate) {
      toast.error('Remplissez tous les champs')
      return
    }
    
    setIsLoading(true)
    try {
      const eventData = {
        name: eventName,
        emoji: eventEmoji,
        startDate: eventStartDate,
        endDate: eventEndDate,
        color: eventColor,
      }
      
      if (editingEvent) {
        const updated = await settingsApi.updateEvent(editingEvent._id, eventData)
        updateEvent(editingEvent._id, updated)
        toast.success('Événement modifié')
      } else {
        const created = await settingsApi.createEvent(eventData)
        addEvent(created)
        toast.success('Événement créé')
      }
      resetEventForm()
    } catch (error) {
      toast.error('Erreur lors de l\'enregistrement')
    } finally {
      setIsLoading(false)
    }
  }
  
  const handleDeleteEvent = async (event: CommercialEvent) => {
    if (!confirm(`Supprimer "${event.name}" ?`)) return
    
    try {
      await settingsApi.deleteEvent(event._id)
      deleteEvent(event._id)
      toast.success('Événement supprimé')
    } catch (error) {
      toast.error('Erreur lors de la suppression')
    }
  }
  
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <Header />
      
      {/* Title */}
      <section className="px-6 mb-6">
        <h1 className="text-2xl font-bold text-foreground font-heading">Réglages</h1>
      </section>
      
      {/* Store Hours */}
      <section className="px-6 mb-8">
        <h2 className="text-lg font-semibold mb-4 font-heading">Horaires de la boutique</h2>
        <div className="bg-card rounded-xl p-5 shadow-sm border border-border/50">
          <div className="space-y-4">
            {DAY_KEYS.map((dayKey, index) => {
              const dayHours = storeHours[dayKey]
              return (
                <div key={dayKey} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground w-20">{DAYS_FR[index]}</span>
                  <div className="flex items-center gap-3">
                    {/* Toggle */}
                    <button
                      onClick={() => handleDayToggle(dayKey)}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        dayHours.isOpen ? 'bg-primary' : 'bg-border'
                      }`}
                    >
                      <div 
                        className={`absolute top-0.5 left-0.5 size-5 bg-white rounded-full transition-transform ${
                          dayHours.isOpen ? 'translate-x-6' : 'translate-x-0'
                        }`} 
                      />
                    </button>
                    
                    {/* Time inputs */}
                    <input
                      type="time"
                      value={dayHours.openTime}
                      onChange={(e) => handleTimeChange(dayKey, 'openTime', e.target.value)}
                      disabled={!dayHours.isOpen}
                      className={`w-20 px-2 py-1.5 text-sm rounded-lg border border-border bg-input ${
                        !dayHours.isOpen ? 'opacity-50' : ''
                      }`}
                    />
                    <span className={`text-muted-foreground ${!dayHours.isOpen ? 'opacity-50' : ''}`}>-</span>
                    <input
                      type="time"
                      value={dayHours.closeTime}
                      onChange={(e) => handleTimeChange(dayKey, 'closeTime', e.target.value)}
                      disabled={!dayHours.isOpen}
                      className={`w-20 px-2 py-1.5 text-sm rounded-lg border border-border bg-input ${
                        !dayHours.isOpen ? 'opacity-50' : ''
                      }`}
                    />
                  </div>
                </div>
              )
            })}
          </div>
          
          <button 
            onClick={handleSaveHours}
            disabled={isLoading}
            className="w-full mt-6 py-3 px-4 bg-primary text-primary-foreground rounded-xl font-semibold shadow-sm active:scale-95 transition-transform disabled:opacity-50"
          >
            {isLoading ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </section>
      
      {/* Commercial Events */}
      <section className="px-6 pb-6">
        <h2 className="text-lg font-semibold mb-4 font-heading">Événements commerciaux</h2>
        
        {/* Events list */}
        <div className="bg-card rounded-xl p-5 shadow-sm border border-border/50 mb-4">
          <div className="space-y-3">
            {events.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                Aucun événement configuré
              </p>
            ) : (
              events.map((event) => (
                <div key={event._id} className="flex items-center gap-3 pb-3 border-b border-border last:border-b-0 last:pb-0">
                  <span className="text-2xl">{event.emoji}</span>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-foreground">{event.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(event.startDate), 'd MMM', { locale: fr })}
                      {event.startDate !== event.endDate && (
                        <> - {format(new Date(event.endDate), 'd MMM', { locale: fr })}</>
                      )}
                    </div>
                  </div>
                  <div 
                    className="size-3 rounded-full" 
                    style={{ backgroundColor: event.color }}
                  />
                  <button 
                    onClick={() => handleEditEvent(event)}
                    className="p-1.5 hover:bg-secondary rounded-lg transition-colors"
                  >
                    <Icon icon="solar:pen-bold" className="size-5 text-muted-foreground" />
                  </button>
                  <button 
                    onClick={() => handleDeleteEvent(event)}
                    className="p-1.5 hover:bg-destructive/10 rounded-lg transition-colors"
                  >
                    <Icon icon="solar:trash-bin-trash-bold" className="size-5 text-destructive" />
                  </button>
                </div>
              ))
            )}
            
            <button 
              onClick={() => setShowEventForm(true)}
              className="w-full py-2.5 px-4 bg-secondary text-secondary-foreground rounded-xl font-medium text-sm flex items-center justify-center gap-2 hover:bg-secondary/80 transition-colors"
            >
              <Icon icon="solar:add-circle-bold" className="size-5" />
              Ajouter un événement
            </button>
          </div>
        </div>
        
        {/* Event form */}
        {showEventForm && (
          <div className="bg-card rounded-xl p-5 shadow-sm border border-border/50 animate-slide-up">
            <div className="space-y-4">
              {/* Event name */}
              <div>
                <label className="block text-sm font-medium mb-2 text-foreground">
                  Nom de l'événement
                </label>
                <input
                  type="text"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="Ex: Soldes de printemps"
                  className="w-full px-4 py-3 rounded-xl border border-border bg-input"
                />
              </div>
              
              {/* Emoji selector */}
              <div>
                <label className="block text-sm font-medium mb-2 text-foreground">Emoji</label>
                <div className="flex gap-2 flex-wrap">
                  {EVENT_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setEventEmoji(emoji)}
                      className={`size-10 rounded-lg flex items-center justify-center text-xl transition-all ${
                        eventEmoji === emoji 
                          ? 'bg-primary/10 ring-2 ring-primary' 
                          : 'bg-secondary hover:bg-muted'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-foreground">
                    Date de début
                  </label>
                  <input
                    type="date"
                    value={eventStartDate}
                    onChange={(e) => setEventStartDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-foreground">
                    Date de fin
                  </label>
                  <input
                    type="date"
                    value={eventEndDate}
                    onChange={(e) => setEventEndDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-input"
                  />
                </div>
              </div>
              
              {/* Color */}
              <div>
                <label className="block text-sm font-medium mb-3 text-foreground">Couleur</label>
                <div className="flex gap-3">
                  {EVENT_COLORS.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setEventColor(color.value)}
                      className={`size-10 rounded-full border-2 shadow-sm transition-transform active:scale-90 ${
                        eventColor === color.value 
                          ? 'ring-2 ring-primary ring-offset-2' 
                          : 'border-background'
                      }`}
                      style={{ backgroundColor: color.value }}
                    />
                  ))}
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={resetEventForm}
                  className="flex-1 py-3 px-4 bg-secondary text-secondary-foreground rounded-xl font-semibold active:scale-95 transition-transform"
                >
                  Annuler
                </button>
                <button 
                  onClick={handleSaveEvent}
                  disabled={isLoading}
                  className="flex-1 py-3 px-4 bg-primary text-primary-foreground rounded-xl font-semibold shadow-sm active:scale-95 transition-transform disabled:opacity-50"
                >
                  {isLoading ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
