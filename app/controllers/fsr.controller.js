import FSR from '../models/fsr.model.js';
import WorkSchedule from '../models/workSchedule.model.js';
import { getLocalDateString } from '../utils/helpers.js';

export const saveFSR = async (req, res) => {
  try {
    const data = { ...req.body };
    if (!data.techName && req.user && req.user.name) {
      data.techName = req.user.name;
    }
    if (data.techSignature) {
      data.status = 'completed';
    } else if (!data.status) {
      data.status = 'pending';
    }

    const newFsr = new FSR(data);
    await newFsr.save();

    // Link and Update Schedule Status to 'completed' if FSR is completed
    if (data.status === 'completed') {
      try {
        const today = getLocalDateString();
        const query = {
          taskDate: today,
          $or: [
            { projectName: data.project },
            { jobNumber: data.jobRef }
          ]
        };
        
        const schedules = await WorkSchedule.find(query);
        for (const schedule of schedules) {
          schedule.status = 'completed';
          schedule.statusDate = today;
          await schedule.save();
          console.log(`[Status] Marked schedule ${schedule.id} as completed for ${schedule.assignedToUsername}`);
        }
      } catch (schedErr) {
        console.error('[Status] Failed to update schedule status:', schedErr.message);
      }
    }

    res.status(201).json(newFsr);
  } catch (error) {
    res.status(500).json({ message: 'Failed to save FSR', error: error.message });
  }
};

export const getFSRs = async (req, res) => {
  try {
    // 30 days logic is handled by TTL index dropping automatically.
    // However, just to be strictly bulletproof as requested, let's filter the DB query:
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const limitNum = Number(req.query?.limit || 0);
    const limit = Number.isFinite(limitNum) ? Math.max(0, Math.min(limitNum, 2000)) : 0;
    const lite = String(req.query?.lite || '').trim() === '1';
    if (lite) res.set('Cache-Control', 'private, max-age=15');
    let q = FSR.find({ createdAt: { $gte: thirtyDaysAgo } }).sort({ createdAt: -1 });
    if (lite) {
      q = q.select({
        _id: 1,
        id: 1,
        project: 1,
        jobRef: 1,
        date: 1,
        techName: 1,
        status: 1,
        createdAt: 1,
      });
    }
    if (limit > 0) q = q.limit(limit);
    const fsrs = await q;
    res.status(200).json(fsrs);
  } catch (error) {
    res.status(500).json({ message: 'Failed to get FSRs', error: error.message });
  }
};
export const updateFSR = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    // If a non-admin employee is submitting/completing the FSR,
    // override techName with their own name so the admin table shows who did the work
    if (req.user && req.user.role !== 'admin') {
      updateData.techName = req.user.shortName || req.user.name || updateData.techName;
      if (req.user.designation) {
        updateData.techDesignation = req.user.designation;
      }
    }

    // Auto-update status to completed if signature is present, unless explicitly set to pending
    if (updateData.techSignature && updateData.status !== 'pending') {
      updateData.status = 'completed';
    }

    const updated = await FSR.findByIdAndUpdate(id, updateData, { returnDocument: 'after' });
    if (!updated) return res.status(404).json({ message: 'FSR not found' });

    // Link and Update Schedule Status
    try {
      if (req.user && req.user.username && updated.project && updated.jobRef) {
        const today = getLocalDateString();
        const query = {
          taskDate: today,
          $or: [
            { projectName: updated.project },
            { jobNumber: updated.jobRef }
          ]
        };
        
        const schedules = await WorkSchedule.find(query);
        for (const schedule of schedules) {
          if (updated.status === 'completed') {
            schedule.status = 'completed';
            schedule.statusDate = today;
          } else if (updated.status === 'pending') {
            schedule.status = 'pending';
            schedule.statusDate = today;
          }
          await schedule.save();
          console.log(`[Status] Marked schedule ${schedule.id} as ${updated.status} on FSR update for ${schedule.assignedToUsername}`);
        }
      }
    } catch (schedErr) {
      console.error('[Status] Failed to update schedule status on update:', schedErr.message);
    }

    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update FSR', error: error.message });
  }
};

export const deleteFSR = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await FSR.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: 'FSR not found' });
    res.status(200).json({ message: 'FSR deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete FSR', error: error.message });
  }
};
