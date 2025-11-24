import { useState, useEffect } from 'react'
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
  { name: 'Bleu-Violet', value: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' },
  { name: 'Rose-Orange', value: 'linear-gradient(135deg, #EC4899, #F97316)' },
  { name: 'Vert-Teal', value: 'linear-gradient(135deg, #10B981, #14B8A6)' },
  { name: 'Orange-Jaune', value: 'linear-gradient(135deg, #F97316, #EAB308)' },
  { name: 'Violet-Rose', value: 'linear-gradient(135deg, #8B5CF6, #EC4899)' },
  { name: 'Teal-Bleu', value: 'linear-gradient(135deg, #14B8A6, #3B82F6)' },
]

const EVENT_EMOJIS = ['🔥', '🏷️', '🎁', '🎄', '💝', '🌸', '☀️', '🎃']

export function Settings() {
  const { 
    storeHours, 
    updateDayHours, 
    events, 
    addEvent, 
    updateEvent, 
    deleteEvent,
    shiftTemplates,
    updateShiftTemplate,
    weekNumberConfig,
    setWeekNumberConfig
  } = useSettingsStore()
  
  const [isLoading, setIsLoading] = useState(false)
  const [hasHoursChanged, setHasHoursChanged] = useState(false)
  const [hasTemplatesChanged, setHasTemplatesChanged] = useState(false)
  const [showEventForm, setShowEventForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CommercialEvent | null>(null)
  
  // Event form state
  const [eventName, setEventName] = useState('')
  const [eventEmoji, setEventEmoji] = useState('🔥')
  const [eventStartDate, setEventStartDate] = useState('')
  const [eventEndDate, setEventEndDate] = useState('')
  const [eventColor, setEventColor] = useState(EVENT_COLORS[0].value)
  
  // Initialiser les dates quand on ouvre le formulaire
  useEffect(() => {
    if (showEventForm && !editingEvent) {
      const today = format(new Date(), 'yyyy-MM-dd')
      setEventStartDate(today)
      setEventEndDate(today)
    }
  }, [showEventForm, editingEvent])
  
  const handleDayToggle = (dayKey: keyof StoreHours) => {
    const current = storeHours[dayKey]
    updateDayHours(dayKey, { ...current, isOpen: !current.isOpen })
    setHasHoursChanged(true)
  }
  
  const handleTimeChange = (dayKey: keyof StoreHours, field: 'openTime' | 'closeTime', value: string) => {
    const current = storeHours[dayKey]
    updateDayHours(dayKey, { ...current, [field]: value })
    setHasHoursChanged(true)
  }
  
  const handleSaveHours = async () => {
    setIsLoading(true)
    try {
      await settingsApi.updateStoreHours(storeHours)
      toast.success('Horaires enregistrés')
      setHasHoursChanged(false)
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
                      className={`w-28 px-3 py-2 text-sm rounded-lg border border-border bg-input ${
                        !dayHours.isOpen ? 'opacity-50' : ''
                      }`}
                    />
                    <span className={`text-muted-foreground ${!dayHours.isOpen ? 'opacity-50' : ''}`}>-</span>
                    <input
                      type="time"
                      value={dayHours.closeTime}
                      onChange={(e) => handleTimeChange(dayKey, 'closeTime', e.target.value)}
                      disabled={!dayHours.isOpen}
                      className={`w-28 px-3 py-2 text-sm rounded-lg border border-border bg-input ${
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
            disabled={isLoading || !hasHoursChanged}
            className={`w-full mt-6 py-3 px-4 rounded-xl font-semibold shadow-sm transition-all ${
              hasHoursChanged 
                ? 'bg-primary text-primary-foreground active:scale-95' 
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            }`}
          >
            {isLoading ? 'Enregistrement...' : hasHoursChanged ? 'Enregistrer' : 'Enregistré ✓'}
          </button>
        </div>
      </section>
      
      {/* Shift Templates */}
      <section className="px-6 mb-8">
        <h2 className="text-lg font-semibold mb-4 font-heading">Templates horaires</h2>
        <div className="bg-card rounded-xl p-5 shadow-sm border border-border/50">
          <p className="text-sm text-muted-foreground mb-4">
            Définissez vos créneaux types pour les appliquer rapidement dans le planning.
          </p>
          <div className="space-y-4">
            {shiftTemplates.map((template, index) => (
              <div key={index} className="flex items-center gap-4">
                <input
                  type="text"
                  value={template.name}
                  onChange={(e) => {
                    updateShiftTemplate(index, { ...template, name: e.target.value })
                    setHasTemplatesChanged(true)
                  }}
                  className="w-32 px-3 py-2 text-sm font-medium rounded-lg border border-border bg-input"
                  placeholder="Nom"
                />
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="time"
                    value={template.startTime}
                    onChange={(e) => {
                      updateShiftTemplate(index, { ...template, startTime: e.target.value })
                      setHasTemplatesChanged(true)
                    }}
                    className="w-28 px-3 py-2 text-sm rounded-lg border border-border bg-input"
                  />
                  <span className="text-muted-foreground">-</span>
                  <input
                    type="time"
                    value={template.endTime}
                    onChange={(e) => {
                      updateShiftTemplate(index, { ...template, endTime: e.target.value })
                      setHasTemplatesChanged(true)
                    }}
                    className="w-28 px-3 py-2 text-sm rounded-lg border border-border bg-input"
                  />
                </div>
              </div>
            ))}
          </div>
          
          <button 
            onClick={() => setHasTemplatesChanged(false)}
            disabled={!hasTemplatesChanged}
            className={`w-full mt-6 py-3 px-4 rounded-xl font-semibold shadow-sm transition-all ${
              hasTemplatesChanged 
                ? 'bg-primary text-primary-foreground active:scale-95' 
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            }`}
          >
            {hasTemplatesChanged ? 'Enregistrer' : 'Enregistré ✓'}
          </button>
        </div>
      </section>
      
      {/* Week Number Config */}
      <section className="px-6 mb-8">
        <h2 className="text-lg font-semibold mb-4 font-heading">Numérotation des semaines</h2>
        <div className="bg-card rounded-xl p-5 shadow-sm border border-border/50">
          <p className="text-sm text-muted-foreground mb-4">
            Définissez le numéro de la semaine actuelle. Les semaines suivantes seront automatiquement incrémentées.
          </p>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">Date de référence</label>
              <input
                type="date"
                value={weekNumberConfig.referenceDate}
                onChange={(e) => setWeekNumberConfig({ 
                  ...weekNumberConfig, 
                  referenceDate: e.target.value 
                })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-input"
              />
            </div>
            <div className="w-32">
              <label className="block text-sm font-medium mb-2">N° de semaine</label>
              <input
                type="number"
                min="1"
                max="52"
                value={weekNumberConfig.referenceWeekNumber}
                onChange={(e) => setWeekNumberConfig({ 
                  ...weekNumberConfig, 
                  referenceWeekNumber: parseInt(e.target.value) || 1 
                })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-input text-center"
              />
            </div>
          </div>
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
        
        {/* Event form MODAL */}
        {showEventForm && (
          <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60] animate-fade-in"
            onClick={resetEventForm}
          >
            <div 
              className="bg-card rounded-2xl shadow-2xl w-full max-w-[500px] max-h-[90vh] overflow-y-auto animate-slide-up"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between rounded-t-2xl">
                <h2 className="text-xl font-semibold text-foreground font-heading">
                  {editingEvent ? 'Modifier événement' : 'Nouvel événement'}
                </h2>
                <button 
                  onClick={resetEventForm}
                  className="size-10 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors"
                >
                  <Icon icon="solar:close-circle-bold" className="size-6 text-muted-foreground" />
                </button>
              </div>
              
              <div className="p-6 space-y-5">
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
                        style={{ background: color.value }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Footer */}
              <div className="sticky bottom-0 bg-card border-t border-border px-6 py-4 flex gap-3 rounded-b-2xl">
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