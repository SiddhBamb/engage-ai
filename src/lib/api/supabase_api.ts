import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_ANON_KEY as string)

interface Person {
  identifier: string
  physical_description: string
}

interface TeachingEvent {
  id?: number
  person_identifier: string
  description: string
  event_type: 'correction' | 'misunderstanding' | 'clarification' | 'comment' | 'distraction'
  created_at?: Date
}

async function createPerson(person: Omit<Person, 'identifier'>): Promise<Person> {
  const { data, error } = await supabase
    .from('people')
    .insert({ ...person })
    .select()
  if (error) throw error
  return data[0]
}

async function getPerson(identifier: string): Promise<Person | null> {
  const { data, error } = await supabase
    .from('people')
    .select()
    .eq('identifier', identifier)
  if (error) throw error
  return data[0] || null
}

async function updatePerson(identifier: string, updates: Partial<Person>): Promise<Person> {
  const { data, error } = await supabase
    .from('people')
    .update(updates)
    .eq('identifier', identifier)
    .select()
  if (error) throw error
  return data[0]
}

async function deletePerson(identifier: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('people')
    .delete()
    .eq('identifier', identifier)
  if (error) throw error
  return !!data
}

async function createTeachingEvent(event: Omit<TeachingEvent, 'id' | 'created_at'>): Promise<TeachingEvent> {
  const { data, error } = await supabase
    .from('teaching_events')
    .insert({
      ...event,
      created_at: new Date(),
    })
    .select()
  if (error) throw error
  return data[0]
}

async function getTeachingEvents(personIdentifier: string): Promise<TeachingEvent[]> {
  const { data, error } = await supabase
    .from('teaching_events')
    .select()
    .eq('person_identifier', personIdentifier)
  if (error) throw error
  return data
}

async function updateTeachingEvent(id: number, updates: Partial<TeachingEvent>): Promise<TeachingEvent> {
  const { data, error } = await supabase
    .from('teaching_events')
    .update(updates)
    .eq('id', id)
    .select()
  if (error) throw error
  return data[0]
}

async function deleteTeachingEvent(id: number): Promise<boolean> {
  const { data, error } = await supabase
    .from('teaching_events')
    .delete()
    .eq('id', id)
  if (error) throw error
  return !!data
}

export {
  createPerson,
  getPerson,
  updatePerson,
  deletePerson,
  createTeachingEvent,
  getTeachingEvents,
  updateTeachingEvent,
  deleteTeachingEvent
}