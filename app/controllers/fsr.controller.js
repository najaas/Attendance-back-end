import FSR from '../models/fsr.model.js';
import WorkSchedule from '../models/workSchedule.model.js';
import { getLocalDateString } from '../utils/helpers.js';

export const saveFSR = async (req, res) => {
  try {
    const data = { ...req.body };
    if (!data.techName && req.user && req.user.name) {
      data.techName = req.user.name;
    }
    if (data.techSignature && !data.status) {
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
          assignedToUsername: req.user.username,
          $or: [
            { projectName: data.project },
            { jobNumber: data.jobRef }
          ]
        };
        
        const schedule = await WorkSchedule.findOne(query).sort({ createdAt: -1 });
        if (schedule) {
          schedule.status = 'completed';
          schedule.statusDate = today;
          await schedule.save();
          console.log(`[Status] Marked schedule ${schedule.id} as completed for ${req.user.username}`);
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
    const fsrs = await FSR.find({ createdAt: { $gte: thirtyDaysAgo } }).sort({ createdAt: -1 });
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

    // Auto-update status based on signature if not explicitly provided
    if (updateData.techSignature && !updateData.status) {
      updateData.status = 'completed';
    }

    const updated = await FSR.findByIdAndUpdate(id, updateData, { new: true });
    if (!updated) return res.status(404).json({ message: 'FSR not found' });

    // Link and Update Schedule Status to 'completed' if FSR is completed
    if (updated.status === 'completed') {
      try {
        if (req.user && req.user.username && updated.project && updated.jobRef) {
          const today = getLocalDateString();
          const query = {
            taskDate: today,
            assignedToUsername: req.user.username,
            $or: [
              { projectName: updated.project },
              { jobNumber: updated.jobRef }
            ]
          };
          
          const schedule = await WorkSchedule.findOne(query).sort({ createdAt: -1 });
          if (schedule) {
            schedule.status = 'completed';
            schedule.statusDate = today;
            await schedule.save();
            console.log(`[Status] Marked schedule ${schedule.id} as completed on FSR update for ${req.user.username}`);
          }
        }
      } catch (schedErr) {
        console.error('[Status] Failed to update schedule status on update:', schedErr.message);
      }
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
